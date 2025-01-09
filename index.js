import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.zitata.tv',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'technique@zitata.tv',
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
});

// Vérifier la configuration SMTP
transporter.verify(function(error, success) {
  if (error) {
    console.error('Erreur de configuration SMTP:', error);
  } else {
    console.log('Serveur SMTP prêt');
  }
});

app.post('/send-planning', async (req, res) => {
  console.log('Réception d\'une requête d\'envoi de planning');
  const { pdfBuffer, employees, weekStartDate } = req.body;
  
  try {
    console.log('Nombre d\'employés reçus:', employees.length);
    console.log('Employés avec email:', employees.filter(e => e.email).length);
    
    const weekStart = new Date(weekStartDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const startDateStr = weekStart.toLocaleDateString('fr-FR');
    const endDateStr = weekEnd.toLocaleDateString('fr-FR');

    console.log('Période:', startDateStr, 'au', endDateStr);
    console.log('Taille du PDF:', pdfBuffer.length);

    // Convertir le tableau en Buffer
    const pdfData = Buffer.from(pdfBuffer);

    const emailPromises = employees
      .filter(employee => employee.email)
      .map(async (employee) => {
        console.log('Tentative d\'envoi à:', employee.email);
        
        const mailOptions = {
          from: 'technique@zitata.tv',
          to: employee.email,
          subject: `Planning du ${startDateStr} au ${endDateStr}`,
          text: `Bonjour ${employee.name},\n\nVeuillez trouver ci-joint votre planning pour la semaine du ${startDateStr} au ${endDateStr}.\n\nCordialement,`,
          attachments: [{
            filename: `planning_${startDateStr}_${endDateStr}.pdf`,
            content: pdfData
          }]
        };

        try {
          const info = await transporter.sendMail(mailOptions);
          console.log('Email envoyé avec succès à', employee.email, 'ID:', info.messageId);
          return { success: true, employee };
        } catch (error) {
          console.error(`Erreur détaillée lors de l'envoi du mail à ${employee.email}:`, error);
          return { success: false, employee, error: error.message };
        }
      });

    const results = await Promise.all(emailPromises);
    console.log('Résultats des envois:', results);
    res.json(results);
  } catch (error) {
    console.error('Erreur détaillée lors de l\'envoi des emails:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
