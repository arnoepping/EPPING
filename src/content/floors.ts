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
    slug: 'rave-wedding', n: '01', name: 'Rave Wedding', tagline: 'From grandma’s favourite to your favourite club',
    headline: 'Your wedding. Let’s rave.',
    intro: 'They say it’s the most important day of your life, so the party should be the best one too. I start where everyone can dance, grandma included, and slowly build towards the club and festival nights you love.',
    body: [
      'Before the wedding, we go through the music you love together, so the second half of the night sounds like your favourite night out. Whether it’s house, techno, trance or something in between.',
      'Club sound and light come with it, so for a few hours your venue feels like the place you’d normally go out to.',
    ],
    includes: ['Planning call and a shared playlist', 'One set, from first dance to final track', 'Club sound and lights, smoke on request'],
    mix: { title: 'Marta & Donald’s wedding', length: 'Set', url: 'https://soundcloud.com/arno-epping/sets/marta-donalds-wedding', embed: 'https://api.soundcloud.com/playlists/2277399272' },
    cta: 'Check your date',
    mail: { subject: 'Rave Wedding booking', body: 'Hi Epping,\n\nWe are getting married on [date] and are interested in booking you as our DJ!\n\n' },
    whatsapp: 'Hi Epping, we are getting married on [date] and are interested in booking you as our DJ!',
  },
  {
    slug: 'private-events', n: '02', name: 'Private Events', tagline: 'Club energy at any venue',
    headline: 'Your party. Let’s dance.',
    intro: 'Birthdays, house parties, company events. Club sound and club lights, at any venue. You bring the people, I bring the peak.',
    body: [
      'Want to level up your party? It comes down to three things: good sound, good lights and music that keeps the dancefloor moving. I take care of all three.',
      'Before the party we go through the music you love and the vibe you want, so the speakers, the lights and the set all match your night.',
    ],
    includes: ['Planning call and a shared playlist', 'One set, from first guest to final track', 'Sound and lights matched to your venue'],
    mix: { title: 'ADE House Mix', length: 'Mix', url: 'https://soundcloud.com/arno-epping/ade-house-mix' },
    cta: 'Plan your party',
    mail: { subject: 'Private event booking', body: 'Hi Epping,\n\nI’m planning a [type of party] on [date] and am interested in booking you as my DJ!\n\n' },
    whatsapp: 'Hi Epping, I’m planning a [type of party] on [date] and am interested in booking you as my DJ!',
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
