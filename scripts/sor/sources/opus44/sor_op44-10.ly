\version "2.19.35"
% Sor, Op. 44 n.º 10. París, chez l’auteur et Pacini, IMSLP #837753 p. 6.
% Cotejo: París #470296 p. 11. Alturas sonantes.
upper = \fixed c {
  \tempo "Allegretto"
  \partial 4. d'4 d'8 |
  g'4 g'8 \acciaccatura { g'16 } fis'8 e'8 fis'8 |
  g'4 g'8 b4 b8 |
  c'4 c'8 c'8 d'8 c'8 |
  b4 r8 d'4 d'8 |
  g'4 g'8 \acciaccatura { g'16 } fis'8 e'8 fis'8 |
  g'4 g'8 fis'4 fis'8 |
  e'4 e'8 \acciaccatura { d'16 } cis'8 b8 cis'8 |
  \partial 4. d'4 r8 \bar ":|." |

  \repeat volta 2 {
    \partial 4. d'4 d'8 |
    c'4 fis'8 \acciaccatura { g'16 } fis'8 e'8 fis'8 |
    g'4 d'8 d'4 d'8 |
    c'4 fis'8 \acciaccatura { g'16 } fis'8 e'8 fis'8 |
    g'4 r8 b'4 b'8 |
    b4 b8 fis'4 fis'8 |
    g'4 g'8 e'4 e'8 |
    d'4( e'8) \acciaccatura { g'16 } fis'8 e'8 fis'8 |
    \partial 4. g'4 r8 |
  }

  \partial 4. g4 g8 |
  r4 e'8 e'4 e'8 |
  d'4. r4 r8 |
  r4 e'8 e'4 e'8 |
  d'4 r8 g'4. |
  fis'4. f'4. |
  <c' e'>4 r8 <c' e'>4. |
  d'4 r8 <c' fis'>4. |
  <b g'>4 r8 <b g'>4. |
  <b g'>4. <b g'>4. |
  <b g'>2. \bar "|." |
}
lower = \fixed c {
  r4 r8 |
  <g b>4 d8 <a c'>4 d8 |
  <g b>4 d8 g4 d8 |
  a4 d8 a4 d8 |
  g4 s8 r4 r8 |
  <g b>4 <d b>8 <a c'>4 <d c'>8 |
  <g b>4 <a cis'>8 <b d'>4 r8 |
  <g b>4 g,8 <a, g>4. |
  <d fis>4 s8 |

  r4 r8 |
  a4 d8 <a c'>4 d8 |
  <g b>4 r8 r4 r8 |
  a4 d8 <a c'>4 d8 |
  <g b>4 r8 r4 r8 |
  r4 r8 dis8 b8 a8 |
  e4. c4 c'8 |
  b4( <cis' ais>8) <a c'>4. |
  <g b>4 s8 |

  s4. |
  s4 c'8 c'8 g8\staccato c'8 |
  b4( g8) g4 g8 |
  s4 c'8 c'8 g8\staccato c'8 |
  b4 s8 b8 g8 b8 |
  a8 c'8 a8 b8 d'8 b8 |
  s4. c8 e8 g8 |
  b8 g8 b8 d8 a8 d8 |
  g4 s8 g8 d8 b,8 |
  g,8 b,8 d8 g8 b,8 d8 |
  g,2. |
}
bass = \fixed c {
  s4. |
  \repeat unfold 7 { s2. | }
  s4. |

  s4. |
  \repeat unfold 5 { s2. | }
  g4.~ g4 s8 |
  d2. |
  s4. |

  s4. |
  g,2. | s2. | g,2. |
  \repeat unfold 3 { s2. | }
  d4. s4. |
  \repeat unfold 3 { s2. | }
}
\score { \context Staff <<
  \time 6/8 \clef "treble_8" \key g \major
  \context Voice = "upper" { \upper }
  \context Voice = "lower" { \lower }
  \context Voice = "bass" { \bass }
>> }
