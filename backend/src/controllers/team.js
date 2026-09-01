const { query }  = require('../db');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

// ── Email sender ──────────────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendInviteEmail(toEmail, inviterName, orgName, role, token) {
  const appUrl    = process.env.APP_URL || 'http://localhost:5173';
  const acceptUrl = `${appUrl}/accept-invite?token=${token}`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from:    `"Universal Analyzer" <${process.env.SMTP_USER}>`,
    to:      toEmail,
    subject: `${inviterName} invited you to join ${orgName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#6366f1">You've been invited!</h2>
        <p>Hi there,</p>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on Universal Analyzer as a <strong>${role}</strong>.</p>
        <a href="${acceptUrl}"
           style="display:inline-block;margin:24px 0;padding:12px 28px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Accept Invitation
        </a>
        <p style="color:#94a3b8;font-size:13px">This invitation expires in 7 days. If you didn't expect this, ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
        <p style="color:#94a3b8;font-size:12px">Universal Dataset Analyzer</p>
      </div>
    `,
  });
}

// ── Controllers ───────────────────────────────────────────────────────────────
async function getTeam(req, res, next) {
  try {
    const orgResult = await query(
      `SELECT o.id, o.name, o.plan FROM organizations o
       JOIN org_members om ON om.org_id = o.id
       WHERE om.user_id = $1 LIMIT 1`,
      [req.user.id]
    );
    if (orgResult.rows.length === 0) return res.json({ members: [], org: null });

    const org = orgResult.rows[0];
    const membersResult = await query(
      `SELECT om.id, om.role, om.status, om.joined_at, om.invited_email,
              u.id as user_id, u.name, u.email
       FROM org_members om
       LEFT JOIN users u ON u.id = om.user_id
       WHERE om.org_id = $1
       ORDER BY om.joined_at ASC`,
      [org.id]
    );

    // الـ orgs التانية اللي هو member فيها (مش owner)
    const memberOfResult = await query(
      `SELECT o.id, o.name, o.plan, u.name as owner_name, u.email as owner_email, om.role
       FROM organizations o
       JOIN org_members om ON om.org_id = o.id
       JOIN users u ON u.id = o.owner_id
       WHERE om.user_id = $1
         AND om.status = 'active'
         AND o.owner_id != $1`,
      [req.user.id]
    );

    res.json({
      org,
      members: membersResult.rows.map(m => ({
        id:       m.id,
        userId:   m.user_id,
        name:     m.name || m.invited_email,
        email:    m.email || m.invited_email,
        role:     m.role,
        status:   m.status,
        joinedAt: m.joined_at,
      })),
      memberOf: memberOfResult.rows.map(o => ({
        orgId:      o.id,
        orgName:    o.name,
        plan:       o.plan,
        ownerName:  o.owner_name,
        ownerEmail: o.owner_email,
        role:       o.role,
      })),
    });
  } catch (err) { next(err); }
}

async function inviteMember(req, res, next) {
  try {
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // جيب الـ org وتأكد إن المستخدم owner أو admin
    const orgResult = await query(
      `SELECT o.id, o.name FROM organizations o
       JOIN org_members om ON om.org_id = o.id
       WHERE om.user_id = $1 AND om.role IN ('owner', 'admin') LIMIT 1`,
      [req.user.id]
    );
    if (orgResult.rows.length === 0) {
      return res.status(403).json({ error: 'You must be an owner or admin to invite members' });
    }

    const { id: orgId, name: orgName } = orgResult.rows[0];
    const inviteToken = uuidv4();
    const expires     = new Date(Date.now() + 7 * 24 * 3600000); // 7 days

    // لو المستخدم موجود اتحقق مش member أصلاً
    const userResult = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    const userId     = userResult.rows[0]?.id || null;

    if (userId) {
      const existing = await query(
        'SELECT id FROM org_members WHERE org_id = $1 AND user_id = $2',
        [orgId, userId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'User is already a member' });
      }
    }

    const result = await query(
      `INSERT INTO org_members (org_id, user_id, role, status, invited_email, invite_token, invite_expires)
       VALUES ($1, $2, $3, 'invited', $4, $5, $6)
       RETURNING id, role, status, joined_at`,
      [orgId, userId, 'member', email.toLowerCase(), inviteToken, expires]
    );

    // ابعت الـ email
    try {
      await sendInviteEmail(email.toLowerCase(), req.user.name, orgName, role || 'viewer', inviteToken);
    } catch (emailErr) {
      console.error('Failed to send invite email:', emailErr.message);
      // مش بنفشل الـ request لو الـ email فشل
    }

    res.status(201).json({
      member: {
        id:       result.rows[0].id,
        email:    email.toLowerCase(),
        role:     result.rows[0].role,
        status:   result.rows[0].status,
        joinedAt: result.rows[0].joined_at,
      },
    });
  } catch (err) { next(err); }
}

async function acceptInvite(req, res, next) {
  try {
    const { token } = req.params;

    // جيب الـ invite
    const inviteResult = await query(
      `SELECT om.id, om.org_id, om.role, om.invited_email, om.invite_expires
       FROM org_members om
       WHERE om.invite_token = $1 AND om.status = 'invited'`,
      [token]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or already used invite link' });
    }

    const invite = inviteResult.rows[0];

    // اتحقق مش expired
    if (invite.invite_expires && new Date() > new Date(invite.invite_expires)) {
      return res.status(400).json({ error: 'Invite link has expired' });
    }

    // لو المستخدم مسجل دخول، اربطه بالـ org
    if (req.user) {
      // امسح الـ invite القديمة من الـ org بتاع المدعو لو موجودة
      // وأضفه للـ org الجديدة
      await query(
        `UPDATE org_members
         SET user_id = $1, status = 'active', joined_at = NOW(), invite_token = NULL, invite_expires = NULL
         WHERE id = $2`,
        [req.user.id, invite.id]
      );
      return res.json({ joined: true, orgId: invite.org_id });
    }

    // لو مش مسجل دخول، ابعت الـ invite info عشان الـ frontend يعرف يعمل redirect
    res.json({
      inviteValid: true,
      email:       invite.invited_email,
      role:        invite.role,
      orgId:       invite.org_id,
      token,
    });
  } catch (err) { next(err); }
}

async function updateMember(req, res, next) {
  try {
    const { role } = req.body;
    if (!['member', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be member or admin' });
    }
    const orgResult = await query(
      `SELECT o.id FROM organizations o
       JOIN org_members om ON om.org_id = o.id
       WHERE om.user_id = $1 AND om.role IN ('owner', 'admin') LIMIT 1`,
      [req.user.id]
    );
    if (orgResult.rows.length === 0) return res.status(403).json({ error: 'Insufficient permissions' });

    const result = await query(
      `UPDATE org_members SET role = $1 WHERE id = $2 AND org_id = $3 RETURNING id, role`,
      [role, req.params.memberId, orgResult.rows[0].id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Member not found' });

    res.json({ member: result.rows[0] });
  } catch (err) { next(err); }
}

async function removeMember(req, res, next) {
  try {
    const orgResult = await query(
      `SELECT o.id FROM organizations o
       JOIN org_members om ON om.org_id = o.id
       WHERE om.user_id = $1 AND om.role IN ('owner', 'admin') LIMIT 1`,
      [req.user.id]
    );
    if (orgResult.rows.length === 0) return res.status(403).json({ error: 'Insufficient permissions' });

    const result = await query(
      'DELETE FROM org_members WHERE id = $1 AND org_id = $2 RETURNING id',
      [req.params.memberId, orgResult.rows[0].id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Member not found' });

    res.json({ message: 'Member removed' });
  } catch (err) { next(err); }
}

module.exports = { getTeam, inviteMember, acceptInvite, updateMember, removeMember };