\version "2.19.35"
% Sor, Op. 44 n.º 6. París, chez l’auteur et Pacini, IMSLP #837753 p. 4.
% Cotejo: París #470296 p. 7. Alturas sonantes.
upper = \fixed c {
  \tempo "Moderato"
  \partial 4 g'4 |
  d'4 b4 g4 |
  d4 b,4 g,8 a,8 |
  b,8 c8 d8 e8 fis8 g8 |
  a8 b8 c'8 d'8 e'4 |
  c'4 a4 fis4 |
  g8 b8 d8 g8 b,8 d8 |

  c8 e8 a,4 d4 |
  g,4 r4 b4 |
  b8 b,8 dis8 fis8 b8 a8 |
  g8 e8 g8 b8 e'8 g'8 |
  fis'8 dis'8 b8 a8 fis8 b8 |
  g4 e4 b4 |
  a8 a,8 cis8 e8 a8 g8 |

  fis8 a8 d'8 a8 fis8 a8 |
  g8 b8 e8 g8 cis8 e8 |
  d4 d'4 d8 e8 |
  fis8 g8 a8 b8 c'8 b8 |
  a8 g8 fis8 e8 d8 c8 |
  b,8 d8 c8 b,8 a,8 g,8 |

  fis,8 a,8 d4 d'8 e'8 |
  fis'8 g'8 a'8 b'8 c''8 b'8 |
  a'8 g'8 fis'8 e'8 d'8 c'8 |
  b8 d'8 cis'8 e'8 g'8 cis'8 |
  d'4 d4 g8 g'8 |
  d8 d'8 b,8 b8 g,8 g8 |

  d4 b,4 g,8 a,8 |
  b,8 c8 d8 e8 fis8 g8 |
  a8 b8 c'8 d'8 e'4 |
  c'8 e'8 a8 c'8 fis8 a8 |
  g8 b8 d8 g8 b,8 d8 |
  c8 e8 s4 <d c' fis'>4 |
  <b g'>2 r4 \bar ":|." |
}
sustained = \fixed c {
  s4 |
  \repeat unfold 5 { s2. | }
  g4 d4 b,4 |
  c4 s2 |
  s2. |
  b4 s2 |
  \repeat unfold 4 { s2. | }
  % The score adds the downward stem to the opening F sharp.
  fis4 s2 |
  \repeat unfold 9 { s2. | }
  s2 g4 |
  d4 b,4 g,4 |
  \repeat unfold 3 { s2. | }
  c'4 a4 fis4 |
  g4 d4 b,4 |
  c4 a,4 s4 |
  g,2 s4 |
}
\score { \context Staff <<
  \time 3/4 \clef "treble_8" \key g \major
  \context Voice = "upper" { \upper }
  \context Voice = "sustained" { \sustained }
>> }
