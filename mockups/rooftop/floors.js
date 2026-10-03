// Floor pages behind the three buttons on the roof. Mockup copy: edit freely.
// Contact details are PLACEHOLDERS (same as src/content/floors.ts): replace with the real email and WhatsApp number.
window.CONTACT = { email: 'hello@eppingmusic.com', whatsapp: '31600000000', whatsappLabel: '+31 6 0000 0000' };

window.FLOORS = [
  {
    id: 'rave-wedding', n: '01', name: 'Rave Wedding', tagline: 'ABBA to acid',
    headline: 'Your wedding. Our rave.',
    intro: 'We start with the songs your aunt knows and end with the ones she never forgets. One DJ who reads the room from the first dance to the last track, so the night quietly turns into a proper rave.',
    body: [
      'Before the day we sit down together: your must-plays, your never-plays, the moment the dancefloor should explode. On the night it is one continuous set, built around your crowd.',
      'From drinks after the ceremony to the afterparty, with light and smoke that turn any venue into a club for a few hours.',
    ],
    includes: ['Planning call and a shared playlist', 'DJ set from first dance to last song', 'Club sound and light show, smoke on request', 'Room for 50 to 250 guests'],
    mix: { title: 'Rave Wedding mix', length: '62 min', url: 'https://soundcloud.com/eppingmusic/rave-wedding' },
    cta: 'Book your date',
    mail: { subject: 'Rave Wedding booking', body: 'Hi Epping,\n\nWe are getting married on [date] at [venue] and would love a rave wedding.\n\n' },
    whatsapp: 'Hi Epping! We are getting married on [date] and want a rave wedding.',
  },
  {
    id: 'private-events', n: '02', name: 'Private Events', tagline: 'Club night, private list',
    headline: 'Your party. Club-grade.',
    intro: 'Birthdays, company nights, rooftops, living rooms. Club sound, club lights and no awkward first hour. You bring the people, I bring the peak.',
    body: [
      'Every crowd is different, so every set is too: disco and house while people arrive, then building toward the moment nobody wants to go home.',
      'I bring the gear and set up and break down myself, so all you have to do is send the invites.',
    ],
    includes: ['DJ set of 3 to 6 hours', 'Sound system and lights', 'Indoor, outdoor or rooftop', 'Set-up and break-down included'],
    mix: { title: 'Rooftop Session 001', length: '58 min', url: 'https://soundcloud.com/eppingmusic/private-events' },
    cta: 'Plan your party',
    mail: { subject: 'Private event booking', body: 'Hi Epping,\n\nI am planning a [type of party] on [date] for about [number] guests.\n\n' },
    whatsapp: 'Hi Epping! I am planning a party on [date] and would like to book you.',
  },
  {
    id: 'presents', n: '03', name: 'Epping Presents', tagline: 'Our own nights',
    headline: 'Not a party. A ritual.',
    intro: 'Our own nights. Public, loud and a little unhinged. One room, one sound system, everybody welcome.',
    body: [
      'A few times a year we take over a rooftop, a basement or a place nobody expected and throw the party we want to go to ourselves.',
      'Locations are announced to the list first. Get on it and you hear about the next one before anyone else.',
    ],
    event: { date: 'Sat 14 November', place: 'Amsterdam, secret location', note: 'Vol. 03 · 22:00 – 05:00' },
    includes: ['Announcements via WhatsApp and Instagram', 'Early-bird tickets for the list', 'Guest DJs from the Amsterdam scene'],
    mix: { title: 'Epping Presents Vol. 02 (live)', length: '75 min', url: 'https://soundcloud.com/eppingmusic/presents' },
    cta: 'Get on the list',
    mail: { subject: 'Epping Presents: put me on the list', body: 'Hi Epping,\n\nPlease put me on the list for the next Epping Presents.\n\n' },
    whatsapp: 'Hi Epping! Put me on the list for the next Epping Presents.',
  },
];
