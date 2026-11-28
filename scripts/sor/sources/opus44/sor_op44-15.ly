\version "2.19.35"
% Sor, Op. 44 n.º 15. París, chez l’auteur et Pacini, IMSLP #837753 p. 8.
% Cotejo: París #470296 p. 16. Alturas sonantes.
upper = \fixed c {
  \tempo "Andante"

  \partial 8 a'16 g'16 |
  fis'8 e'8 d'8 cis'8 |
  b8 a8 g8 fis8 |
  e8 fis16 g16 a8 g8 |
  fis8 e8 d8 a,8 |
  d8 fis16 a16 d'8 fis'8 |
  e'8 a'16 gis'16 fis'16 e'16 d'16 cis'16 |
  b16 a16 gis16 fis16 e16 d16 cis16 b,16 |
  \partial 4. a,8 <cis' a'>8 a,8 \bar ":|." |

  \partial 8 \bar ".|:" a'16 g'16 |
  fis'8 e'8 dis'4 |
  e'8 fis'8 g'8 g'16 fis'16 |
  e'8 d'8 cis'4 |
  d'8 e'8 fis'8 d'16 cis'16 |
  b8 e'16 d'16 cis'8 b8 |
  ais8 cis'8 fis'8 ais8 |
  b16 e'16 g'16 fis'16 e'16 d'16 cis'16 b16 |
  ais8 cis'8 fis'8 ais8 |

  b8 fis'8 d'8 b8 |
  c'8 e'8 g'8 e'8 |
  dis'8 fis'8 a'8 dis'8 |
  \acciaccatura { fis'16 } e'16 dis'16 e'16 fis'16 g'8 b'16 a'16 |
  g'16 fis'16 e'16 d'16 cis'8 cis'8 |

  d'4. d'8 |
  e'16 dis'16 e'16 fis'16 e'16 b16 e'16 d'16 |
  d'16( cis'16) b16 a16 a8 a'16 g'16 |
  fis'8 e'8 d'8 cis'8 |
  b8 a8 g8 fis8 |

  e8 fis16 g16 a8 g8 |
  fis8 e8 d8 d'16 cis'16 |
  b8 e'8 cis'8 fis'16 e'16 |
  d'8 g'8 e'8 a'16 g'16 |
  <d' fis'>8 <b d'>8 e'8 cis'8 |
  <d fis d'>4 r4 \bar "|." |
}
lower = \fixed c {
  s8 |
  \repeat unfold 7 { s2 | }
  s4. |
  s8 |
  r4 r8 b16 a16 |
  g8 fis8 e8 r8 |
  r4 r8 a16 g16 |
  fis8 e8 d8 fis8 |
  g2 |
  fis4. fis8 |
  g2 |
  fis4. fis16 e16 |

  d2 | e2 | fis2 |
  g4 r4 |
  r4 r8 a16 g16 |

  fis16 e16 d16 cis16 b,16 cis16 b,16 a,16 |
  gis,2 |
  a,4. r8 |
  d4. e16 fis16 |
  g8 fis8 e8 d8 |

  cis8 b,8 a,8 b,16 cis16 |
  d4 r8 fis8 |
  g8 gis8 a8 ais8 |
  b8 b8 cis'8 a8 |
  s4 g8 <a, g>8 |
  s2 |
}
\score { \context Staff <<
  \time 2/4 \clef "treble_8" \key d \major
  \context Voice = "upper" { \upper }
  \context Voice = "lower" { \lower }
>> }
