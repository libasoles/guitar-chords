\version "2.19.35"
% Sor, Op. 44 n.º 8. París, chez l’auteur et Pacini, IMSLP #837753 p. 5.
% Cotejo: París #470296 p. 9. Alturas sonantes.
upper = \fixed c {
  \tempo "Allegretto"
  \repeat unfold 3 { d'8 g'8 b8 c'8 | }
  e'4 d'8 r8 | g'4 fis'4 | e'4 d'8 b8 | c'4 b4 |
  a4 d'8 d'8 |
  \repeat unfold 3 { d'8 g'8 b8 c'8 | }
  e'4 d'8 r8 | g'4 fis'4 | e'4 d'8 b8 | <a c'>4. a8 |
  <g b>4 r4 |
  a4 s8 d'8 | <g b>4 s8 d'8 | cis'4 s8 e'8 | d'4 a4 |
  a4 s8 d'8 | <g b>4 s8 d'8 | cis'4 s8 e'8 | d'4 r4 |
  e'4 s8 dis'8 | e'4 s8 d'8 | c'4 b4 | c'4 cis'4 |
  d'4 s8 c'8 | <g b>4 s8 d'8 | c'4 b4 | a8 b8 c'8 cis'8 |
  \repeat unfold 3 { d'8 g'8 b8 c'8 | }
  e'4 d'8 r8 | g'4 fis'4 | e'4 d'8 b8 | c'4 b4 |
  a4 d'8 d'8 |
  \repeat unfold 3 { d'8 g'8 b8 c'8 | }
  e'4 d'8 r8 | g'4 fis'4 | e'4 d'8 b8 | <a c'>4. a8 |
  <g b>4 r4 | \bar "|."
}
lower = \fixed c {
  \repeat unfold 3 { b4 g8 a8 | }
  c'4 b8 g8 | e'8 g8 d'8 g8 | c'8 g8 b8 g8 | a8 fis8 g8 d8 |
  fis8 d8 r8 s8 |
  \repeat unfold 3 { b4 g8 a8 | }
  c'4 b8 g8 | e'8 g8 d'8 g8 | c'8 g8 b8 g8 | r8 c8 d8 fis8 |
  r8 d8 g,4 |
  fis8 d8 fis8\staccato d8 | g8 d8 g8\staccato d8 |
  g8 d8 g8\staccato d8 | fis8 d8 fis8 d8 |
  fis8 d8 fis8\staccato d8 | g8 d8 g8\staccato d8 |
  g8 d8 g8\staccato d8 | fis8 d8 d8 d8 |
  c'8 d8 c'8\staccato b8 | c'8 d8 c'8\staccato b8 |
  a8 d8 gis8 e8 | a8 d8 g8 d8 |
  fis8 d8 fis8\staccato a8 | s8 d8 g8\staccato b8 | a8 d8 g8 d8 | fis8 g8 a8 ais8 |
  \repeat unfold 3 { b4 g8 a8 | }
  c'4 b8 g8 | e'8 g8 d'8 g8 | c'8 g8 b8 g8 | a8 fis8 g8 d8 |
  fis8 d8 r8 s8 |
  \repeat unfold 3 { b4 g8 a8 | }
  c'4 b8 g8 | e'8 g8 d'8 g8 | c'8 g8 b8 g8 | r8 c8 d8 fis8 |
  r8 d8 g,4 |
}
\score { \context Staff <<
  \time 2/4 \clef "treble_8" \key g \major
  \context Voice = "upper" { \upper }
  \context Voice = "lower" { \lower }
>> }
