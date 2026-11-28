\version "2.19.35"
% Sor, Op. 44 n.º 11. París, chez l’auteur et Pacini, IMSLP #837753 p. 6.
% Cotejo: París #470296 p. 12. Alturas sonantes.
upper = \fixed c {
  \tempo "Andante"
  b4 e'4 c'4 e'4 |
  b4 e'8. fis'16 g'4 b4 |
  fis'4 b4 fis'4 b4 |
  g'4.. fis'16 e'4 r4 |
  b4 e'4 c'4 e'4 |
  b4 e'8. fis'16 g'2 |
  g'4( fis'4) fis'4 e'4 |
  \partial 2. dis'4 b4 r4 \bar ":|." |

  \repeat volta 2 {
    <g b>4 <a c'>4 <b d'>4 <g b g'>4 |
    g'2 fis'2 |
    e'4 g'4 fis'4 e'4 |
    e'2 dis'4 r4 |
    b4 b4 b4 b4 |
    b4.. e'16 g'2 |
    g'4( fis'4) e'4 dis'4 |
    e'2 r2 |
  }
}
lower = \fixed c {
  <e g>2 <e a>2 |
  <e g>2. r4 |
  <dis a>2 <dis a>2 |
  g4 b4 g4 s4 |
  <e g>2 <e a>2 |
  <e g>2. <e, b>4 |
  <a c'>2 a4 g4 |
  <b, fis>4 s4 b,4 |

  s1 |
  c'2. <b~ a>4 |
  b4 s4 a4 g4 |
  g4 b4 fis4 s4 |
  r4 <fis a>4 <fis a>4 <fis a>4 |
  <e g>4. s8 s4 <g b>4 |
  <a c'>2 <g b>4 <fis a>4 |
  g2 s2 |
}
bass = \fixed c {
  \repeat unfold 3 { s1 | }
  e2 s2 |
  s1 | s1 |
  a,2 s4 ais,4 |
  s2. |

  g,2 r4 s4 |
  a4 d2 dis4 |
  <e g>4 e,4 a,4 ais,4 |
  b,2 s2 |
  dis2 s2 |
  s4 e,2 s4 |
  r4 a,4 b,2 |
  e4 b,4 e,2 |
}
\score { \context Staff <<
  \time 4/4 \clef "treble_8" \key e \minor
  \context Voice = "upper" { \upper }
  \context Voice = "lower" { \lower }
  \context Voice = "bass" { \bass }
>> }
