\version "2.19.35"
% Sor, Op. 44 n.º 22. París, chez l’auteur et Pacini, IMSLP #837753 p. 12.
% Cotejo: París #470296 p. 23. Alturas sonantes.
upper = \fixed c {
  \tempo "Andantino"
  e'8 e'8 e'8 e'8 |
  <a c' e'>4 a'4 |
  <d' f'>8 <c' e'>8 <b d'>8 <a c'>8 |
  b8 e'4.~ |
  e'8 e'4 e'8 |
  e'4 fis'4 |

  r8 e'4 dis'8 |
  e'4 a8 d'8 |
  <c' e'>8 e'8 e'8 e'8 |
  <a c' e'>4 a'4 |
  <d' f'>8 <c' e'>8 <b d'>8 <a c'>8 |
  b8 e'4. |

  r8 e'8 e'8 e'8 |
  e'4 fis'4 |
  <g b>8 e'4 dis'8 |
  <g e'>4 r4 |

  \bar ".|:" e'4. e'8 |
  f'2 |
  e'4. e'8 |
  f'4 s4 |
  e'8 <c' e'>8 <bes g'>8 <bes g'>8 |
  g'8( f'8) c'4~ |
  c'8 cis'8 d'8 <a dis'>8 |
  <gis e'>4 r4 |
  e'8 e'8 e'8 e'8 |

  <a c' e'>4 a'4 |
  <d' f'>8 <c' e'>8 <b d'>8 <a c'>8 |
  b8 e'8 dis'8 d'8 |
  r8 a'8 <d' gis'>8 <e' g'>8 |
  <e' g'>8 <d' f'>8 <c' e'>8 <b d'>8 |
  <a c'>8 <a c'>8 <b d'>8 <gis b>8 |
  a8 <e c'>8 s4 \bar ":|." |
}
lower = \fixed c {
  <a c'>8 <a c'>8 <gis b>8 <b d'>8 |
  s4 r8 a,8 |
  d4. dis8 |
  <e gis>4 <fis a>8 <gis b>8 |
  <a c'>8 <a c'>8 <gis b>8 <b d'>8 |
  <a c'>2 |

  <g b>4 <fis a>4 |
  <e g>8 <d gis>8 c8 <b, gis>8 |
  <a, a>8 <a c'>8 <gis b>8 <b d'>8 |
  s4 r8 a,8 |
  d4. dis8 |
  <e gis>4 <fis a>8 <gis b>8 |

  <a c'>8 <a c'>8 <gis b>8 <b d'>8 |
  r4 r8 a,8 |
  b,2 |
  r8 e8 e,4 |

  c2~ |
  c2 |
  c2~ |
  c2 |
  c4 r8 e8 |
  <f a>2 |
  <f a>4. r8 |
  r8 e16 d16 c8 b,8 |
  a,8 <a c'>8 <gis b>8 <b d'>8 |

  s4 r8 a,8 |
  d4. dis8 |
  <e gis>4 r4 |
  a,2 |
  d2 |
  e4 e,4 |
  a,4 a,4 |
}
inner = \fixed c {
  s2 | s2 | s2 | s2 | s2 | s2 |
  s2 | s2 | s2 | s2 | s2 | s2 |
  s2 | <a c'>2 | s8 s8 <fis a>4 | s2 |

  g8 c'8 c'8 c'8 |
  b16 cis'16( d'16) b16 g8 g8~ |
  g8 c'8 c'8 c'8 |
  b16 cis'16( d'16) b16 g8 g8~ |
  g8 s8 s4 |
  s2 |
  s2 |
  s2 |
  s2 |

  s2 | s2 | s2 |
  cis'4 s4 |
  s2 | s2 | s2 |
}
\score { \context Staff <<
  \time 2/4 \clef "treble_8" \key a \minor
  \context Voice = "upper" { \upper }
  \context Voice = "lower" { \lower }
  \context Voice = "inner" { \inner }
>> }
