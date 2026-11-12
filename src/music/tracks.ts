export type MusicTrack = {
  id: string;
  title: string;
  composer: string;
  composerUrl: string;
  src: string;
  license: string;
  licenseUrl: string;
  provider: string;
  providerUrl: string;
};

export const musicTracks: readonly MusicTrack[] = [{
  id: 'airoso',
  title: 'Airoso',
  composer: 'WombatNoisesAudio',
  composerUrl: 'https://soundcloud.com/user-734462061',
  src: '/music/airoso.mp3',
  license: 'Creative Commons (BY 3.0)',
  licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  provider: 'BreakingCopyright',
  providerUrl: 'https://breakingcopyright.com',
}, {
  id: 'caribbean-night',
  title: 'Caribbean Night',
  composer: 'Justin Allan Arnold',
  composerUrl: 'https://soundcloud.com/justin-allan-arnold',
  src: '/music/caribbean-night.mp3',
  license: 'Creative Commons (BY 4.0)',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  provider: 'BreakingCopyright',
  providerUrl: 'https://breakingcopyright.com',
}, {
  id: 'cada-minuto-cuenta',
  title: 'Cada Minuto Cuenta',
  composer: 'Justin Allan Arnold',
  composerUrl: 'https://soundcloud.com/justin-allan-arnold',
  src: '/music/cada-minuto-cuenta.mp3',
  license: 'Creative Commons (BY 3.0)',
  licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  provider: 'BreakingCopyright',
  providerUrl: 'https://breakingcopyright.com',
}, {
  id: 'salome',
  title: 'Salome',
  composer: 'Justin Allan Arnold',
  composerUrl: 'https://soundcloud.com/justin-allan-arnold',
  src: '/music/salome.mp3',
  license: 'Creative Commons (BY 3.0)',
  licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  provider: 'BreakingCopyright',
  providerUrl: 'https://breakingcopyright.com',
}, {
  id: 'la-calle-oscura',
  title: 'La Calle Oscura',
  composer: 'Justin Allan Arnold',
  composerUrl: 'https://soundcloud.com/justin-allan-arnold',
  src: '/music/la-calle-oscura.mp3',
  license: 'Creative Commons (BY 3.0)',
  licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  provider: 'BreakingCopyright',
  providerUrl: 'https://breakingcopyright.com',
}];
