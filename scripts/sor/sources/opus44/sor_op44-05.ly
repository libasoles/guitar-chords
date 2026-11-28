\version "2.19.35"
% Sor, Op. 44 n.º 5. París, chez l’auteur et Pacini, IMSLP #837753 p. 4.
% Cotejo: París #470296 p. 6. Alturas sonantes.
upper = \fixed c {
  \tempo "Andantino"
  e'16 c'16 g8 g8 |
  g4. |
  f'16 d'16 g8 g8 |
  g4. |
  g16 c'16 e'8 e'8 |
  e'8 a8 f'8~ |
  f'8 b8 c'8 |
  d'16 b16 g8 g'8 |

  e'16 c'16 g8 g8 |
  g4. |
  f'16 d'16 g8 g8 |
  g4. |
  g16 c'16 e'8 e'8~ |
  e'16 a16 d'16 e'16 f'8~ |
  f'8 b16 c'16 d'16 b16 |
  c'8 r8 g8 |

  d'4 d'8 |
  e'4 e'8 |
  g'16( f'16) e'16( f'16) d'16 b16 |
  c'16 e'16 g8 g8 |
  d'4 d'8 |
  e'4 e'8 |
  fis'4 fis'8 |
  <b g'>4 r8 |

  d'4 d'8 |
  e'4 e'8 |
  g'16( f'16) e'16( f'16) d'16 b16 |
  c'16 e'16 g8 g8 |
  d'4 d'8 |
  e'4 e'8 |
  fis'4 fis'8 |
  <b g'>4 g8 |

  e'16 c'16 g8 g8 |
  g4. |
  f'16 d'16 g8 g8 |
  g4. |
  g16 c'16 e'8 e'8 |
  e'8 a8 f'8~ |
  f'8 b16( d'16) c'16 e'16 |
  d'16( cis'16) d'16 b16 g8 |

  e'16 c'16 g8 g8 |
  g4. |
  f'16 d'16 g8 g8 |
  g4. |
  c16 e16 g16 c'16 e'8 |
  f16 a16 d'16 e'16 f'8 |
  r8 <g b>8 <f b>8 |
  c'4. \bar "|." |
}
lower = \fixed c {
  c4.~ |
  c8 e8 c8 |
  b,4.~ |
  b,8 b,8 b,8 |
  c4. |
  f4. |
  g4.~ |
  g8 r4 |

  c4.~ |
  c8 e8 c8 |
  b,4.~ |
  b,8 b,8 b,8 |
  c4. |
  f4. |
  <f g>4. |
  c8 s4 |

  b,4 s8 |
  c4 s8 |
  d4. |
  e4. |
  b,4. |
  c4. |
  s16 d4 s16 |
  g8 g8 g8 |

  b,4. |
  c4. |
  d8 g8 f8 |
  e4. |
  b,4. |
  c4. |
  s16 d4 s16 |
  g4 r8 |

  c4.~ |
  c8 e8 c8 |
  b,4.~ |
  b,8 b,8 b,8 |
  c4. |
  f4. |
  g4.~ |
  g4 r8 |

  c4.~ |
  c8 e8 c8 |
  b,4.~ |
  b,8 b,8 b,8 |
  c4. |
  f4. |
  g,4. |
  <c e>4. |
}
inner = \fixed c {
  \repeat unfold 16 { s4. | }

  d'16 g16 g4 |
  e'16 g16 g4 |
  s4. |
  s4. |
  d'16 g16 g4 |
  e'16 e16 g16 c'16 s8 |
  fis'16 d16 a16 c'16 s8 |
  s4. |

  d'16 g16 g4 |
  e'16 g16 g4 |
  s4. |
  s4. |
  d'16 g16 g4 |
  e'16 e16 g16 c'16 e'16 c'16 |
  fis'16 d16 a16 c'16 fis'16 c'16 |
  s4. |

  \repeat unfold 16 { s4. | }
}
\score { \context Staff <<
  \time 3/8 \clef "treble_8" \key c \major
  \context Voice = "upper" { \upper }
  \context Voice = "inner" { \inner }
  \context Voice = "lower" { \lower }
>> }
