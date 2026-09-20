import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { users, projects } from './schema';
import { eq } from 'drizzle-orm';
import { generateToken, verifyToken } from './utils/auth';

const app = express();
app.use(cors());
app.use(express.json());

// Auth Middleware
const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  (req as any).user = payload;
  next();
};

// --- AUTH ROUTES ---

app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Check if user exists
    const existingUser = db.select().from(users).where(eq(users.email, email)).get();
    if (existingUser) {
      if (!existingUser.isVerified) {
        // Resend code logic could go here, for simplicity we just reject or we could generate a new code.
        // Let's generate a new code and update the existing unverified user.
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
        
        db.update(users).set({
          verificationCode: code,
          verificationCodeExpiresAt: expiresAt
        }).where(eq(users.id, existingUser.id)).run();
        
        console.log(`\n[MOCK EMAIL] To: ${email} | Subject: Verify your account | Body: Your verification code is: ${code}\n`);
        return res.json({ message: 'Verification code resent', requiresVerification: true, email });
      }
      return res.status(400).json({ error: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    
    const result = db.insert(users).values({
      email,
      password: hashedPassword,
      name,
      isVerified: false,
      verificationCode: code,
      verificationCodeExpiresAt: expiresAt
    }).returning({ id: users.id, email: users.email, name: users.name }).get();

    console.log(`\n[MOCK EMAIL] To: ${email} | Subject: Verify your account | Body: Your verification code is: ${code}\n`);
    
    res.json({ message: 'Registration successful, please verify email', requiresVerification: true, email: result.email });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = db.select().from(users).where(eq(users.email, email)).get();
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Please verify your email address first', requiresVerification: true, email: user.email });
    }

    const token = generateToken({ id: user.id, email: user.email });
    
    res.json({ 
      user: { id: user.id, email: user.email, name: user.name }, 
      token 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/auth/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    const user = db.select().from(users).where(eq(users.email, email)).get();
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (!user.verificationCodeExpiresAt || new Date() > new Date(user.verificationCodeExpiresAt)) {
      return res.status(400).json({ error: 'Verification code has expired. Please register again to get a new code.' });
    }

    // Mark as verified and clear code
    const updatedUser = db.update(users).set({
      isVerified: true,
      verificationCode: null,
      verificationCodeExpiresAt: null
    }).where(eq(users.id, user.id)).returning({ id: users.id, email: users.email, name: users.name }).get();

    const token = generateToken({ id: updatedUser.id, email: updatedUser.email });
    
    res.json({ 
      message: 'Email verified successfully',
      user: updatedUser, 
      token 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/auth/me', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const user = db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, userId)).get();
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROJECT ROUTES ---

app.get('/api/projects', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const userProjects = db.select().from(projects).where(eq(projects.userId, userId)).all();
    
    // Parse data before sending
    const parsed = userProjects.map(p => ({
      ...p,
      data: JSON.parse(p.data)
    }));
    
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const projectData = req.body; // ProjectDocument
    
    const result = db.insert(projects).values({
      id: projectData.id,
      userId,
      data: JSON.stringify(projectData)
    }).returning().get();
    
    res.json({ ...result, data: JSON.parse(result.data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const projectId = req.params.id;
    const projectData = req.body; // ProjectDocument
    
    const existing = db.select().from(projects).where(eq(projects.id, projectId)).get();
    
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const result = db.update(projects)
      .set({ data: JSON.stringify(projectData), updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning().get();
      
    res.json({ ...result, data: JSON.parse(result.data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
