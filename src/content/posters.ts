// Stairwell posters, bottom of the stairs first: one pair per spot, [left wall, right wall], facing each other.
// Images live in public/posters/ (square covers ~640 px; the event poster is 4:5). To swap one: replace the file or edit this list.
export interface Poster { src: string; aspect?: number } // aspect = height / width, default 1
export const POSTERS: [Poster, Poster][] = [
  [{ src: 'posters/green-velvet-la-la-land.jpg' }, { src: 'posters/floating-points-cascade.jpg' }],
  [{ src: 'posters/faithless-insomnia.jpg' }, { src: 'posters/mau-p-just-a-little-bit-more.jpg' }],
  [{ src: 'posters/malugi-be-my-lover.jpg' }, { src: 'posters/cassian-ar-co-come-to-life.jpg' }],
  // the upcoming Epping night; swap for a cover after 22 Oct 2026
  [{ src: 'posters/silent-disco-hoofddorpplein.jpg', aspect: 1.25 }, { src: 'posters/julian-fijma-get-stupid.jpg' }],
  [{ src: 'posters/sharam-patt-remix.jpg' }, { src: 'posters/pirupa-party-non-stop.jpg' }],
  [{ src: 'posters/moodymann-i-cant-kick-this-feeling.jpg' }, { src: 'posters/tomora-aurora-i-drink-the-light-jengi-remix.jpg' }],
];
