\version "2.19.35"
% Sor, Op. 44 n.º 9. París, chez l’auteur et Pacini, IMSLP #837753 p. 6.
% Cotejo: París #470296 p. 10. Alturas sonantes.
upper = \fixed c {
  \tempo "Andantino"
  \repeat volta 2 {
    b4 b4 c'4 c'4 |
    d'2 e'2 |
    <fis a>4 <g b>4 <a c'>4\staccato <fis d'>4 |
    <g b>2 r2 |
    b4 b4 cis'4 cis'4 |
    <a d'>2 <b e'>2 |
    fis'4 d'4 e'4 cis'4 |
  }
  \alternative {
    { <fis d'>4 r4 r2 | }
    { <fis d'>2 r2 | }
  }
  \repeat volta 2 {
    d'4 d'4 e'4 b4 |
    c'2 a2 |
    b4 b4 c'4 b4 |
    a4 d'4 cis'4 c'4 |
    <g b>4 <g b>2 <g b>4 |
    c'4 e'4 g'4 cis'4 |
    <b d'>4 <g b>4 <a c'>4\staccato <fis a>4 |
  }
  \alternative {
    { g4 d4 g4 b4 | }
    { g4 <g b>4 r2 \bar "|." | }
  }
}
lower = \fixed c {
  g4 g2 g4~ |
  g4 g2 g4 |
  d2 s4 r4 |
  r4 g,4 b,4 d4 |
  g2 <e g>2 |
  fis4 d4 g4 g,4 |
  a4 fis4 g2 |
  d4 d4 c4 a,4 |
  d4 d4 d4 d4 |
  r4 b4 gis2 |
  a4 d4 fis4 d4 |
  g4 d4 a4 g4 |
  fis2 r2 |
  r4 g4 fis4 f4 |
  <e g>2. <dis ais>4 |
  d2 s4 r4 |
  s1 |
  r4 d4 g,2 |
}
bass = \fixed c {
  g,2 a,2 |
  b,2 c2 |
  \repeat unfold 4 { s1 | }
  a,2 s2 |
  s1 |
  s1 |
  d2 s2 |
  \repeat unfold 8 { s1 | }
}
\score { \context Staff <<
  \time 4/4 \clef "treble_8" \key g \major
  \context Voice = "upper" { \upper }
  \context Voice = "lower" { \lower }
  \context Voice = "bass" { \bass }
>> }
