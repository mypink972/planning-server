import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Route racine simple
app.get('/', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Route de test des variables d'environnement
app.get('/env', (req, res) => {
  res.json({
    environment: process.env.NODE_ENV,
    smtp: {
      host: process.env.SMTP_HOST || 'not set',
      port: process.env.SMTP_PORT || 'not set',
      secure: process.env.SMTP_SECURE || 'not set',
      user: process.env.SMTP_USER || 'not set',
      hasPassword: process.env.SMTP_PASS ? 'yes' : 'no'
    }
  });
});

// Route de test email
app.get('/test-email', async (req, res) => {
  try {
    const testTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: 'Test de configuration email',
      text: 'Si vous recevez cet email, la configuration SMTP fonctionne correctement.'
    };

    const info = await testTransporter.sendMail(mailOptions);
    res.json({ 
      success: true, 
      messageId: info.messageId 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: {
        message: error.message,
        code: error.code,
        command: error.command
      }
    });
  }
});

// Route d'envoi de planning
app.post('/send-planning', async (req, res) => {
  const { pdfBuffer, employees, weekStartDate } = req.body;
  
  try {
    if (!pdfBuffer || !employees || !weekStartDate) {
      throw new Error('Données manquantes dans la requête');
    }

    const weekStart = new Date(weekStartDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const startDateStr = weekStart.toLocaleDateString('fr-FR');
    const endDateStr = weekEnd.toLocaleDateString('fr-FR');

    const pdfData = Buffer.from(pdfBuffer);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const results = await Promise.all(
      employees
        .filter(employee => employee.email)
        .map(async (employee) => {
          try {
            const info = await transporter.sendMail({
              from: process.env.SMTP_USER,
              to: employee.email,
              subject: `Planning du ${startDateStr} au ${endDateStr}`,
              text: `Bonjour ${employee.name},\n\nVeuillez trouver ci-joint votre planning pour la semaine du ${startDateStr} au ${endDateStr}.\n\nCordialement,`,
              attachments: [{
                filename: `planning_${startDateStr}_${endDateStr}.pdf`,
                content: pdfData
              }]
            });
            return { success: true, employee, messageId: info.messageId };
          } catch (error) {
            return { success: false, employee, error: error.message };
          }
        })
    );

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
