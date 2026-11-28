\version "2.19.35"
% Sor, Op. 44 n.º 4. París, chez l’auteur et Pacini, IMSLP #837753 p. 3.
% Cotejo: París #470296 p. 5. Alturas sonantes.
upper = \fixed c {
  \tempo "Allegretto moderato"
  \partial 8 g8 |
  \repeat volta 2 {
    c'4. b8 |
    a4. d'16 c'16 |
    b8 f'4 d'16 b16 |
    c'8 d'8 e'8 g8 |
    c'4. e'8 |
    d'4. g'8 |
    fis'8. e'16 d'16( c'16) a16 fis16 |
    g8 r8 r8 g8 |
  }
  \repeat volta 2 {
    g'4. a'8 |
    g'8 f'4 d'8 |
    f'16( e'16) d'16 c'16 b16 a16 e'16 d'16 |
    c'4 b8 g8 |

    c'4. cis'8 |
    d'4. d'8 |
    d'4~ d'16 a16 d'16 c'16 |
    b4 r8 g8\staccato |
    c'4. b8 |
    a8 b16 c'16 d'8 c'8 |

    b8 f'4 d'16 b16 |
    c'8 d'8 e'8 c'8 |
    g'4. e'16 c'16 |
    a4. d'8 |
    g16 c'16 e'4 d'16 b16 |
  }
  \alternative {
    { c'4 r8 g8 | }
    { \partial 4. c'4 r8 \bar "|." | }
  }
}
bass = \fixed c {
  s8 |
  r8 c8 e4 |
  r8 f8 d4 |
  r8 g,8 g8 f8 |
  e8 d8 c4 |
  r8 e8 c4 |
  r8 b,8 g4 |
  r8 c8 d8 r8 |
  r8 g,8 g4 |

  r8 e8 cis8 a,8 |
  r8 d16 c16 b,8 r8 |
  c8 e8 f4 |
  r8 g8 g,4 |

  r8 e,8 g4 |
  r8 f,8 a4 |
  r8 fis,8 d4 |
  r8 g,8 g8 f8 |
  e8 d8 c8 d16 e16 |
  f8 e8 d8\staccato e16 f16 |

  g8 g,8 g8 f8 |
  e8 d8 c4 |
  r8 e,8 g4 |
  r8 f,8 f4 |
  g4 g,4 |
  c8 <e g>8 c8 s8 |
  c8 <e g>8 c8 |
}
inner = \fixed c {
  s8 |
  \repeat unfold 9 { s2 | }
  s4. d'16 g16 |
  \repeat unfold 14 { s2 | }
  s4. |
}
\score { \context Staff <<
  \time 2/4 \clef "treble_8" \key c \major
  \context Voice = "upper" { \upper }
  \context Voice = "bass" { \bass }
  \context Voice = "inner" { \inner }
>> }
