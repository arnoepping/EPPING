export type Slug = 'rave-wedding' | 'private-events' | 'presents';
export interface PresentsEvent { date: string; venue: string; ticketUrl: string }
export interface Floor {
  slug: Slug; name: string; tagline: string; headline: string; lines: string[];
  color: string; accent: string; bpm: number; soundcloudUrl: string;
  booking?: { subject: string; whatsappText: string };
  presents?: { event: PresentsEvent | null; vibe: string };
}

export const CONTACT = { email: 'bookings@eppingmusic.com', whatsapp: '31640187865', instagram: 'epping.music', soundcloud: 'https://soundcloud.com/arno-epping' };

export const FLOORS: Floor[] = [
  {
    slug: 'rave-wedding', name: 'Rave Wedding', tagline: 'ABBA to acid',
    headline: 'Your wedding. Our rave.',
    lines: [
      'We start with the songs your aunt knows. We end with the ones she never forgets.',
      'One dancefloor, no exit, mirrorball overhead.',
      'Only for couples who want the night to end in a proper rave.',
    ],
    color: '#FF2BD6', accent: '#EDEDF3', bpm: 126,
    soundcloudUrl: 'https://soundcloud.com/arno-epping/sets/marta-donalds-wedding',
    booking: { subject: 'Rave Wedding booking', whatsappText: 'Hi EPPING! We want a rave wedding.' },
  },
  {
    slug: 'private-events', name: 'Private Events', tagline: 'Club night, private list',
    headline: 'Your party. Club-grade.',
    lines: [
      'Birthdays, company nights, rooftops, living rooms.',
      'Club sound, club lights, no awkward first hour.',
      'You bring the people. We bring the peak.',
    ],
    color: '#00E5FF', accent: '#EDEDF3', bpm: 124,
    soundcloudUrl: 'https://soundcloud.com/arno-epping/ade-house-mix',
    booking: { subject: 'Private event booking', whatsappText: 'Hi EPPING! I have a private event.' },
  },
  {
    slug: 'presents', name: 'Epping Presents', tagline: 'Our own nights',
    headline: 'Not a party. A ritual.',
    lines: [
      'Our own nights. Public, loud, a little unhinged.',
      'One room, one sound system, everybody welcome.',
    ],
    color: '#FF2BD6', accent: '#00E5FF', bpm: 138,
    soundcloudUrl: 'https://soundcloud.com/arno-epping/ade-house-mix',
    presents: {
      event: { date: '2026-12-12', venue: 'TBA, Amsterdam', ticketUrl: 'https://www.instagram.com/epping.music/' },
      vibe: 'Strobes, sweat, and the best Saturday of your month.',
    },
  },
];

export const SLUGS: Slug[] = FLOORS.map((f) => f.slug);
export const floorBySlug = (s: string): Floor | undefined => FLOORS.find((f) => f.slug === s);
