// Floor pages: copy and links. Edit freely; the same content feeds the overlay on / and the /<slug>/ routes.
export type Slug = 'rave-wedding' | 'private-events' | 'presents';
export interface Floor {
  slug: Slug; n: string; name: string; tagline: string; headline: string; intro: string; body: string[]; includes: string[];
  event?: { date: string; place: string; note: string };
  /** url: public SoundCloud page; embed: optional player URL (SoundCloud's own api URL works best for sets) */
  mix: { title: string; length: string; url: string; embed?: string };
  cta: string; mail: { subject: string; body: string }; whatsapp: string;
}

export const CONTACT = {
  email: 'bookings@eppingmusic.com', whatsapp: '31640187865', whatsappLabel: '+31 6 4018 7865',
  instagram: 'https://www.instagram.com/epping.music/', instagramLabel: '@epping.music', soundcloud: 'https://soundcloud.com/arno-epping',
};

export const FLOORS: Floor[] = [
  {
    slug: 'rave-wedding', n: '01', name: 'Rave Wedding', tagline: 'ABBA to acid',
    headline: 'Your wedding. Our rave.',
    intro: 'We start with the songs your aunt knows and end with the ones she never forgets. One DJ who reads the room from the first dance to the last track, so the night quietly turns into a proper rave.',
    body: [
      'Before the day we sit down together: your must-plays, your never-plays, the moment the dancefloor should explode. On the night it is one continuous set, built around your crowd.',
      'From drinks after the ceremony to the afterparty, with light and smoke that turn any venue into a club for a few hours.',
    ],
    includes: ['Planning call and a shared playlist', 'DJ set from first dance to last song', 'Club sound and light show, smoke on request', 'Room for 50 to 250 guests'],
    mix: { title: 'Marta & Donald’s wedding', length: 'Set', url: 'https://soundcloud.com/arno-epping/sets/marta-donalds-wedding', embed: 'https://api.soundcloud.com/playlists/2277399272' },
    cta: 'Book your date',
    mail: { subject: 'Rave Wedding booking', body: 'Hi Epping,\n\nWe are getting married on [date] at [venue] and would love a rave wedding.\n\n' },
    whatsapp: 'Hi Epping! We are getting married on [date] and want a rave wedding.',
  },
  {
    slug: 'private-events', n: '02', name: 'Private Events', tagline: 'Club night, private list',
    headline: 'Your party. Club-grade.',
    intro: 'Birthdays, company nights, rooftops, living rooms. Club sound, club lights and no awkward first hour. You bring the people, I bring the peak.',
    body: [
      'Every crowd is different, so every set is too: disco and house while people arrive, then building toward the moment nobody wants to go home.',
      'I bring the gear and set up and break down myself, so all you have to do is send the invites.',
    ],
    includes: ['DJ set of 3 to 6 hours', 'Sound system and lights', 'Indoor, outdoor or rooftop', 'Set-up and break-down included'],
    mix: { title: 'ADE House Mix', length: 'Mix', url: 'https://soundcloud.com/arno-epping/ade-house-mix' },
    cta: 'Plan your party',
    mail: { subject: 'Private event booking', body: 'Hi Epping,\n\nI am planning a [type of party] on [date] for about [number] guests.\n\n' },
    whatsapp: 'Hi Epping! I am planning a party on [date] and would like to book you.',
  },
  {
    slug: 'presents', n: '03', name: 'Epping Presents', tagline: 'Our own nights',
    headline: 'Not a party. A ritual.',
    intro: 'Our own nights. Public, loud and a little unhinged. One room, one sound system, everybody welcome.',
    body: [
      'A few times a year we take over a rooftop, a basement or a place nobody expected and throw the party we want to go to ourselves.',
      'Locations are announced to the list first. Get on it and you hear about the next one before anyone else.',
    ],
    event: { date: 'Thu 22 October 2026', place: 'Hoofddorpplein, Amsterdam', note: 'Silent disco during ADE · 19:00 – 22:00' }, // remove after the night to hide the block
    includes: ['Announcements via WhatsApp and Instagram', 'Early-bird tickets for the list', 'Guest DJs from the Amsterdam scene'],
    mix: { title: 'ADE House Mix', length: 'Mix', url: 'https://soundcloud.com/arno-epping/ade-house-mix' },
    cta: 'Get on the list',
    mail: { subject: 'Epping Presents: put me on the list', body: 'Hi Epping,\n\nPlease put me on the list for the next Epping Presents.\n\n' },
    whatsapp: 'Hi Epping! Put me on the list for the next Epping Presents.',
  },
];

export const SLUGS: Slug[] = FLOORS.map((f) => f.slug);
export const floorBySlug = (s: string): Floor | undefined => FLOORS.find((f) => f.slug === s);
