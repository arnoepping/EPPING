// About EPPING: text from the user's doc "EPPING — About text" (https://claude.ai/code/artifact/f0670db6-1cf9-437e-95eb-9971189b5873), used exactly as written.
// long = the About page; short = bios (Instagram, SoundCloud, Google Business Profile) and the search data on the About page.
import type { Lang } from './floors.ts';

export const ABOUT_PATH: Record<Lang, string> = { en: '/about/', nl: '/nl/over/' };

export const ABOUT: Record<Lang, { title: string; description: string; kicker: string; link: string; services: string; long: string[]; short: string }> = {
  en: {
    title: 'About EPPING | DJ and party host from Amsterdam',
    description: 'EPPING is a DJ and party host from Amsterdam: house, tech house, techno and a bit of trance, for weddings, private events and our own parties.',
    kicker: 'About',
    link: 'About EPPING',
    services: 'Book EPPING for',
    long: [
      "Parties run in my family. My dad organised karaoke nights at the campsites in France where we went on holiday. At home we had a big garage with a sound system, disco lights, mics, and that’s where family and friends came to party. For every special occasion (birthday, anniversary, etc.) we wrote our own songs.",
      "No wonder I’ve been obsessed with music for as long as I can remember. As a kid I sang, rapped and wrote songs. I never learned an instrument, though. I was too busy playing tennis, and I’ve regretted it ever since.",
      "Then, at almost thirty, I got my hands on a pair of DJ decks. Finally, an instrument I couldn’t stop practising. Now I spend my evenings digging for tracks and my nights out Shazamming whatever gets the room moving. What comes out is a set that’s all about energy: house, tech house, techno and a bit of trance. Groovy, bassy, and usually with a turn you didn’t see coming.",
      "My fiancée and I were already the ones throwing the parties in our friend group. Then, on a weekend away to talk about what we want from life, it clicked: I wanted to do more with music, and throw the kind of parties I grew up with. That’s how EPPING was born. Rooftops, weddings, living rooms. Anywhere we can plug in."
    ],
    short: "I’m EPPING, a DJ and party host from Amsterdam. I grew up in a family that always threw the party, and only found DJing at almost thirty. I’ve been making up for lost time ever since, digging through house, tech house, techno and a bit of trance for hidden gems.",
  },
  nl: {
    title: 'Over EPPING | DJ en party host uit Amsterdam',
    description: 'EPPING is een DJ en party host uit Amsterdam: house, tech house, techno en een beetje trance, voor bruiloften, privéfeesten en onze eigen feesten.',
    kicker: 'Over',
    link: 'Over EPPING',
    services: 'Boek EPPING voor',
    long: [
      "Feesten zit in de familie. Mijn vader organiseerde karaoke-avonden op de campings in Frankrijk waar we op vakantie gingen. Thuis hadden we een grote garage met een geluidsinstallatie, discolampen en microfoons, en daar kwamen familie en vrienden om te feesten. Voor elke speciale gelegenheid (verjaardagen, jubilea) schreven we onze eigen liedjes.",
      "Geen wonder dat ik al zo lang als ik me kan herinneren geobsedeerd ben door muziek. Als kind zong ik, rapte ik en schreef ik nummers. Een instrument heb ik nooit geleerd. Daar was ik te druk voor met tennis, en daar heb ik altijd spijt van gehad.",
      "Tot ik, bijna dertig, achter een set DJ-decks belandde. Eindelijk een instrument dat ik niet meer kon wegleggen. Sindsdien ben ik ’s avonds aan het diggen naar tracks en Shazam ik er tijdens het stappen aardig op los. Het resultaat: sets die draaien om energie. House, tech house, techno en een beetje trance. Groovy, bassy, en meestal met een wending die je niet ziet aankomen.",
      "Mijn verloofde en ik waren al degenen die de feestjes gaven in onze vriendengroep. Tijdens een heiweekend, samen weg om te praten over wat we willen in het leven, viel alles op zijn plek: ik wilde meer met muziek doen, en het soort feesten geven waarmee ik ben opgegroeid. Zo is EPPING ontstaan. Op daken, bruiloften en in woonkamers. Overal waar de stekker in kan."
    ],
    short: "Ik ben EPPING, DJ en party host uit Amsterdam. Ik groeide op in een familie die altijd het feest gaf, en ontdekte het draaien pas op mijn bijna-dertigste. Sindsdien haal ik de verloren tijd in, op zoek naar hidden gems in house, tech house, techno en een beetje trance.",
  },
};
