const { query } = require('../db');
const { chatWithDataset } = require('../services/ai');

async function getSessions(req, res, next) {
  try {
    const result = await query(
      `SELECT cs.id, cs.title, cs.dataset_id, cs.created_at, cs.updated_at,
              d.name as dataset_name,
              COUNT(cm.id) as message_count
       FROM chat_sessions cs
       LEFT JOIN datasets d ON d.id = cs.dataset_id
       LEFT JOIN chat_messages cm ON cm.session_id = cs.id
       WHERE cs.user_id = $1
       GROUP BY cs.id, d.name
       ORDER BY cs.updated_at DESC`,
      [req.user.id]
    );

    const sessions = result.rows.map(s => ({
      id: s.id,
      title: s.title,
      datasetId: s.dataset_id,
      datasetName: s.dataset_name,
      messageCount: parseInt(s.message_count),
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    res.json({ sessions });
  } catch (err) {
    next(err);
  }
}

async function getSession(req, res, next) {
  try {
    const sessionResult = await query(
      'SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const msgResult = await query(
      'SELECT id, role, content, created_at FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );

    const session = sessionResult.rows[0];
    res.json({
      session: {
        id: session.id,
        title: session.title,
        datasetId: session.dataset_id,
        messages: msgResult.rows.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.created_at,
        })),
        createdAt: session.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function createSession(req, res, next) {
  try {
    const { datasetId, title } = req.body;

    if (datasetId) {
      const dsCheck = await query(
        'SELECT id FROM datasets WHERE id = $1 AND user_id = $2',
        [datasetId, req.user.id]
      );
      if (dsCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Dataset not found' });
      }
    }

    const result = await query(
      `INSERT INTO chat_sessions (user_id, dataset_id, title) VALUES ($1, $2, $3)
       RETURNING id, title, dataset_id, created_at`,
      [req.user.id, datasetId || null, title || 'New Conversation']
    );

    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function sendMessage(req, res, next) {
  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const sessionResult = await query(
      'SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Save user message
    await query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [session.id, 'user', message]
    );

    // Get conversation history
    const historyResult = await query(
      'SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT 20',
      [session.id]
    );

    const messages = historyResult.rows.map(m => ({ role: m.role, content: m.content }));

    // Get dataset context if available
    let datasetContext = {};
    if (session.dataset_id) {
      const dsResult = await query(
        `SELECT d.name, d.file_path, d.rows_count, d.columns_count, d.format, d.health_score,
                ar.result_data
         FROM datasets d
         LEFT JOIN analysis_results ar ON ar.dataset_id = d.id AND ar.result_type = 'summary'
         WHERE d.id = $1`,
        [session.dataset_id]
      );
      if (dsResult.rows.length > 0) {
        const ds = dsResult.rows[0];
        let sampleRows = '';

        // قراءة عينة من الصفوف الأولى من الملف الحقيقي لتوفير سياق دقيق للذكاء الاصطناعي
        try {
          const fs = require('fs');
          if (ds.file_path && fs.existsSync(ds.file_path) && (ds.format === 'csv' || ds.format === 'tsv')) {
            const content = fs.readFileSync(ds.file_path, 'utf8');
            const lines = content.split(/\r?\n/).filter(l => l.trim()).slice(0, 40);
            sampleRows = lines.join('\n');
          }
        } catch (fileErr) {
          console.warn('Could not read sample rows for chat:', fileErr.message);
        }

        datasetContext = {
          name: ds.name,
          rows: ds.rows_count,
          columns: ds.columns_count,
          format: ds.format,
          healthScore: ds.health_score,
          columnSummary: ds.result_data?.columns || [],
          sampleStats: ds.result_data?.stats || null,
          sampleRows: sampleRows || null,
        };
      }
    }

    // Get AI response
    const aiResponse = await chatWithDataset(messages, datasetContext);

    // Save assistant message
    const aiMsgResult = await query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3) RETURNING id, created_at',
      [session.id, 'assistant', aiResponse]
    );

    // Update session title if first message
    if (messages.length <= 2) {
      const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');
      await query('UPDATE chat_sessions SET title = $1, updated_at = NOW() WHERE id = $2', [title, session.id]);
    } else {
      await query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1', [session.id]);
    }

    res.json({
      message: {
        id: aiMsgResult.rows[0].id,
        role: 'assistant',
        content: aiResponse,
        timestamp: aiMsgResult.rows[0].created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function deleteSession(req, res, next) {
  try {
    const result = await query(
      'DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ message: 'Session deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSessions, getSession, createSession, sendMessage, deleteSession };
