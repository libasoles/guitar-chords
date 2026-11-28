\version "2.19.35"
% Sor, Op. 44 n.º 14. París, chez l’auteur et Pacini, IMSLP #837753 p. 8.
% Cotejo: París #470296 p. 15. Alturas sonantes.
upper = \fixed c {
  \tempo "Tempo di minuetto moderato"
  \partial 4 a,4 |
  d8 fis8 a4 d'4 |
  b4 g4 g'8 e'8 |
  cis'4 a,4 a'8 g'8 |
  fis'4 d4 fis'8 e'8 |
  d'8 cis'8 b8 a8 gis8 fis8 |
  e8 gis8 b8 e'8 \acciaccatura { g'8 } fis'8 e'8 |

  e'8 a8 b8 d'8 gis8 b8 |
  a2 e'8 cis'8 |
  a8 cis'8 e'8 cis'8 e'8 cis'8 |
  a8 d'8 fis'8 d'8 fis'8 d'8 |
  b8 d'8 gis8 b8 e'8 d'8 |
  cis'8 e'8 r4 e'8 cis'8 |
  a8 cis'8 e'8 cis'8 g'8 e'8 |

  d'8 fis'8 a8 d'8 fis'8 d'8 |
  b8 d'8 f'8 b8 d'8 gis8 |
  a4 a,4 a4 |
  d8 fis8 a8 d'8 fis'8 d'8 |
  b8 d'8 g4 g'8 e'8 |
  cis'8 e'8 a,4 a'8 g'8 |
  fis'4 d4 a'8 g'8 |

  fis'8 e'8 dis'8 fis'8 b8 a8 |
  g8 b8 e4 g'8 fis'8 |
  e'8 d'8 cis'8 e'8 a8 g8 |
  fis8 e8 d4 fis'8 e'8 |
  d'8 cis'8 b8 a8 g8 fis8 |
  e8 d8 cis8 b,8 a,8 g,8 |
  fis,8 d8 fis,8 e8 g,8( cis8) |
  d2 r4 \bar "|." |
}
lower = \fixed c {
  s4 |
  \repeat unfold 5 { s2. | }
  e2 d4 |

  cis4 d4 e4 |
  r4 a,2~ |
  a,2. |
  a,2. |
  a,2. |
  r4 a,2~ |
  a,2. |

  a,2.~ |
  a,2 s4 |
  \repeat unfold 11 { s2. | }
}
inner = \fixed c {
  s4 |
  \repeat unfold 8 { s2. | }
  a2 s4 |
  a2 s4 |
  s4 gis2 |
  a2 s4 |
  a2 s4 |
  s4 a2 |
  \repeat unfold 12 { s2. | }
  fis,4 fis,4 g,4 |
  s2. |
}
\score { \context Staff <<
  \time 3/4 \clef "treble_8" \key d \major
  \context Voice = "upper" { \upper }
  \context Voice = "inner" { \inner }
  \context Voice = "lower" { \lower }
>> }
