const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ===== À PERSONNALISER =====
// Numéro au format international, sans "+" ni espaces, suivi de @c.us
// Ex : 06 12 34 56 78 (France) -> 33612345678@c.us
const CONTACT = '33612345678@c.us';
// Dossier où seront enregistrés les exports
const DOSSIER = path.join(os.homedir(), 'WhatsApp-Export');
// ===========================

const ETAT = path.join(DOSSIER, '.dernier-export.json');
fs.mkdirSync(path.join(DOSSIER, 'medias'), { recursive: true });
const depuis = fs.existsSync(ETAT) ? JSON.parse(fs.readFileSync(ETAT)).ts : 0;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.session') }),
  puppeteer: { headless: true },
});

client.on('qr', (qr) => {
  console.log('Scanne ce QR code : WhatsApp > Réglages > Appareils connectés');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  try {
    const chat = await client.getChatById(CONTACT);
    const msgs = (await chat.fetchMessages({ limit: 1000 }))
      .filter((m) => m.timestamp > depuis);

    const jour = new Date().toISOString().slice(0, 10);
    const fichier = path.join(DOSSIER, `${jour}.txt`);
    let dernier = depuis;

    for (const m of msgs) {
      const date = new Date(m.timestamp * 1000).toLocaleString('fr-FR');
      const auteur = m.fromMe ? 'Moi' : chat.name || 'Contact';
      let texte = m.body;

      if (m.hasMedia) {
        try {
          const media = await m.downloadMedia();
          if (media) {
            const ext = (media.mimetype.split('/')[1] || 'bin').split(';')[0];
            const nom = `${m.timestamp}_${m.id.id}.${ext}`;
            fs.writeFileSync(path.join(DOSSIER, 'medias', nom), Buffer.from(media.data, 'base64'));
            texte = `[média : medias/${nom}] ${texte}`;
          }
        } catch {
          texte = `[média non téléchargé] ${texte}`;
        }
      }

      fs.appendFileSync(fichier, `[${date}] ${auteur} : ${texte}\n`);
      dernier = Math.max(dernier, m.timestamp);
    }

    fs.writeFileSync(ETAT, JSON.stringify({ ts: dernier }));
    console.log(`${msgs.length} message(s) exporté(s) vers ${fichier}`);
  } catch (e) {
    console.error('Erreur :', e);
  }
  await client.destroy();
  process.exit(0);
});

client.initialize();
