import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";

const SECTIONS = {
  privacy: {
    title: "Informativa sulla Privacy",
    updated: "Aggiornata al 26 aprile 2026",
    body: [
      {
        h: "1. Titolare del trattamento",
        p: "Waydora è gestito da Waydora S.r.l.s., con sede legale in Italia. Per qualsiasi richiesta relativa ai tuoi dati personali puoi scrivere a waydora.ai@gmail.com.",
      },
      {
        h: "2. Dati raccolti",
        p: "Raccogliamo i dati che ci fornisci direttamente quando pianifichi un viaggio (destinazione, date, numero di viaggiatori, budget, preferenze). Conserviamo gli itinerari salvati per permetterti di ritrovarli e condividerli. Raccogliamo anche dati tecnici minimi (indirizzo IP, browser, pagine visitate) per ragioni di sicurezza e statistica.",
      },
      {
        h: "3. Finalità del trattamento",
        p: "Usiamo i tuoi dati esclusivamente per generare e migliorare i tuoi itinerari di viaggio, mantenere il servizio sicuro e funzionante, e — solo se ci dai consenso — inviarti suggerimenti personalizzati via email.",
      },
      {
        h: "4. Trasferimento a terzi",
        p: "I tuoi prompt vengono inoltrati ai modelli di intelligenza artificiale che generano gli itinerari (provider OpenAI). Non vendiamo né cediamo dati a terzi per fini di marketing. I link di prenotazione che vedi nelle attività sono link affiliati pubblici verso Booking, Airbnb, GetYourGuide, Viator, TheFork, Trainline e Skyscanner.",
      },
      {
        h: "5. Conservazione",
        p: "Gli itinerari salvati vengono conservati finché non chiedi la cancellazione. I dati di sessione vengono cancellati entro 30 giorni dall'ultimo accesso.",
      },
      {
        h: "6. I tuoi diritti",
        p: "In conformità al GDPR, puoi richiedere accesso, rettifica, cancellazione, limitazione e portabilità dei tuoi dati scrivendo a waydora.ai@gmail.com. Puoi inoltre presentare reclamo al Garante per la Protezione dei Dati Personali.",
      },
    ],
  },
  termini: {
    title: "Termini e Condizioni",
    updated: "Aggiornati al 26 aprile 2026",
    body: [
      {
        h: "1. Oggetto del servizio",
        p: "Waydora è un assistente conversazionale che genera proposte di itinerari di viaggio basate sulle tue richieste. Le informazioni fornite sono indicative e non costituiscono prenotazioni effettive né garanzia di disponibilità.",
      },
      {
        h: "2. Uso accettabile",
        p: "Ti impegni a utilizzare Waydora in modo lecito, senza tentare di compromettere il funzionamento del servizio, generare contenuti illegali, offensivi o lesivi di diritti di terzi.",
      },
      {
        h: "3. Prenotazioni e link affiliati",
        p: "Le prenotazioni vengono effettuate sui siti dei nostri partner (Booking, Airbnb, GetYourGuide, Viator, TheFork, Trainline, Skyscanner). Waydora non è parte del contratto di vendita: condizioni, prezzi, cancellazioni e responsabilità sono regolati direttamente dal partner. Riceviamo una commissione su alcune prenotazioni effettuate tramite i nostri link.",
      },
      {
        h: "4. Limitazione di responsabilità",
        p: "Pur impegnandoci nella qualità delle informazioni, non garantiamo l'accuratezza assoluta di prezzi, orari, indirizzi o disponibilità. Verifica sempre i dati sul sito del fornitore prima di acquistare. Waydora non è responsabile per costi o disservizi derivanti da scelte di viaggio basate sull'output dell'AI.",
      },
      {
        h: "5. Proprietà intellettuale",
        p: "Marchio, logo, design e codice di Waydora sono di proprietà di Waydora S.r.l.s. Gli itinerari generati possono essere usati liberamente per scopi personali; non sono consentiti scraping massivi o ridistribuzione commerciale.",
      },
      {
        h: "6. Modifiche e foro competente",
        p: "Possiamo modificare questi termini per esigenze legali o di servizio: ti avviseremo tramite il sito. Per qualsiasi controversia è competente il foro del consumatore o, in subordine, il foro di Milano.",
      },
    ],
  },
  cookie: {
    title: "Cookie Policy",
    updated: "Aggiornata al 26 aprile 2026",
    body: [
      {
        h: "1. Cosa sono i cookie",
        p: "I cookie sono piccoli file di testo che i siti web salvano sul tuo dispositivo per ricordare informazioni utili al loro funzionamento o alla statistica.",
      },
      {
        h: "2. Cookie tecnici (sempre attivi)",
        p: "Usiamo un cookie di sessione necessario per mantenere la tua chat attiva, salvare gli itinerari e proteggere il sito da abusi. Senza questo cookie il servizio non funziona, per questo è esente da consenso ai sensi della normativa europea.",
      },
      {
        h: "3. Cookie analitici",
        p: "Al momento Waydora non utilizza cookie analitici di terze parti (Google Analytics, Meta Pixel o simili). Se in futuro li introdurremo, ti chiederemo il consenso esplicito tramite banner.",
      },
      {
        h: "4. Cookie dei partner di prenotazione",
        p: "Quando clicchi un link affiliato (Booking, Airbnb, ecc.) vieni reindirizzato sul loro sito, dove valgono le loro policy sui cookie. Ti invitiamo a leggerle per ciascun partner.",
      },
      {
        h: "5. Gestione dei cookie",
        p: "Puoi cancellare o bloccare i cookie dalle impostazioni del tuo browser. Disattivare i cookie tecnici impedirà però il corretto funzionamento di Waydora.",
      },
    ],
  },
} as const;

type LegalSlug = keyof typeof SECTIONS;

export default function LegalPage({ params }: { params: { slug: LegalSlug } }) {
  const section = SECTIONS[params.slug];
  if (!section) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-24 text-center">
          <h1 className="font-serif text-3xl font-bold text-foreground">Documento non trovato</h1>
          <p className="mt-3 text-muted-foreground">
            Il documento legale richiesto non esiste o è stato spostato.
          </p>
        </div>
      </Layout>
    );
  }
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-16 md:py-24">
        <div className="space-y-3 mb-10">
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
            Documenti legali
          </span>
          <h1 className="font-serif text-3xl md:text-5xl font-bold text-foreground leading-tight">
            {section.title}
          </h1>
          <p className="text-sm text-muted-foreground">{section.updated}</p>
        </div>
        <Card className="p-6 md:p-10 space-y-8 bg-card/60 border-border/60">
          {section.body.map((b) => (
            <section key={b.h} className="space-y-3">
              <h2 className="font-serif text-xl font-bold text-foreground">{b.h}</h2>
              <p className="text-base text-muted-foreground leading-relaxed">{b.p}</p>
            </section>
          ))}
          <div className="pt-6 border-t border-border/40 text-sm text-muted-foreground">
            Per qualsiasi domanda scrivici a{" "}
            <a href="mailto:waydora.ai@gmail.com" className="text-accent hover:underline">
              waydora.ai@gmail.com
            </a>
            .
          </div>
        </Card>
      </div>
    </Layout>
  );
}
