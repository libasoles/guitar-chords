\version "2.19.35"
% Sor, Op. 44 n.º 7. París, chez l’auteur et Pacini, IMSLP #837753 p. 5.
% Cotejo: París #470296 p. 8. Alturas sonantes.
upper = \fixed c {
  \tempo "Andante Allegro"
  \partial 8 b16. g32 |
  d8 <g b>8 <a c'>8 <bes cis'>8 |
  <b d'>4 b4 |
  c'4 b4 |
  a8 d'4 b16. g32 |
  d8 b8 c'8 cis'8 |
  <b d'>4 b8 e'8 |
  <fis a>8 d'8~ d'16( cis'16) b16 cis'16 |
  \partial 4. <fis d'>4 r8 \bar ":|." |

  \repeat volta 2 {
    \partial 8 d'16 cis'16 |
    c'8 fis'8 <c' fis'>8 <c' fis'>8 |
    g'4 d'8 e'16. d'32 |
    c'8 fis'8 <c' fis'>8 <c' fis'>8 |
    g'4 d'8 d'16. c'32 |
    b8 e'8 b8 e'8 |
    d'8 gis8 <a c'>8 <a c'>16. b32 |
    a8 d'8 a8 d'8\staccato |
    <a c'>4 <g b>8 <g b>16. <a c'>32 |
    <b d'>8 <c' e'>8 <d' fis'>8 <b g'>8 |
    <c' e'>4. <a c'>8 |
    <g b>8 <b d'>8 <a c'>8\staccato <fis a>8 |
    g8 b8 s4 |
  }
}
lower = \fixed c {
  s8 |
  s2 |
  s4 g8 d8 |
  a8 d8 g8 d8 |
  fis4 d4 |
  s8 g8 a8 bes8 |
  s4 g4 |
  s4 g4 |
  r8 d8 d8 |

  r8 |
  a8 d8 a8 d8 |
  <g b>8 d8 b8 c'16. b32 |
  a8 d8 a8 d8 |
  <g b>8 d8 b8 b16. a32 |
  gis8 e8 gis8 e8 |
  r8 e4 s16. g32 |
  fis8 d8 fis8 d8 |
  s8 d8 s8 r8 |
  s2 |
  r8 c16. b,32 a,8 c8 |
  d4 s8 r8 |
  s8 d8 g,4 |
}
sustained = \fixed c {
  s8 |
  \repeat unfold 6 { s2 | }
  a,2 |
  s4. |

  s8 |
  \repeat unfold 5 { s2 | }
  a,4 s4 |
  s2 |
  g,4 s4 |
  \repeat unfold 4 { s2 | }
}
\score { \context Staff <<
  \time 2/4 \clef "treble_8" \key g \major
  \context Voice = "upper" { \upper }
  \context Voice = "lower" { \lower }
  \context Voice = "sustained" { \sustained }
>> }
