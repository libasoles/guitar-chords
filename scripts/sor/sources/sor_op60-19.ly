\version "2.19.35"
% Transcripción: París, chez l’auteur, ca. 1837, IMSLP #836891.
% Fuente: #836891, p. 13; cotejo: Gitarrefreund #43476, p. 2; París #470312, p. 22.
% Alturas que suenan; plicas independientes conservadas; sin digitación añadida.
upper = \fixed c {
  
  \repeat volta 2 {
  b4.\segno c'4. | % 1
  d'4. g'4. | % 2
  b4. c'4. | % 3
  d'4. d'8 d'8 dis'8 | % 4
  e'4. d'4. | % 5
  } \alternative { {
  cis'4. d'4. | % 6
  c'4. b4. | % 7
  a4. d'8 cis'8 c'8 | % 8
  } {
  cis'4. d'4 dis'8 | % 9
  e'4. \acciaccatura g'8 fis'8 e'8 fis'8 | % 10
  <b g'>4. r4 \mark "Fine" r8 | % 11
  } }
  a4. b4. | % 12
  b4. cis'4. | % 13
  b4. c'4. | % 14
  cis'4. d'4. | % 15
  e'4. d'4. | % 16
  <c' fis'>4. <b g'>4. | % 17
  c'4. b4 \acciaccatura d'8 c'8 | % 18
  b4. a4 r8 | % 19
  a4. b4. | % 20
  <gis b>4 d'8 c'4. | % 21
  b4. c'4. | % 22
  <cis' e'>4. d'4. | % 23
  d'4. <b b'>4 d'8 | % 24
  c'4. <c' a'>4 c'8 | % 25
  b4. <g cis'>4. | % 26
  d'4.~ d'8 \mark "D.S." cis'8 c'8 | % 27
}
inner = \fixed c {
  \repeat volta 2 {
  s8 g8 g8 s8 g8 g8 | % 1
  s8 g8 g8 s8 g8 g8 | % 2
  s8 g8 g8 s8 g8 g8 | % 3
  s8 g8 g8 g4. | % 4
  s8 g8 g8 s8 g8 g8 | % 5
  } \alternative { {
  s8 g8 g8 s8 d8 d8~ | % 6
  d8 e8 fis8 g8 d8 d8 | % 7
  s8 d8 d8 s4. | % 8
  } {
  s8 g8 g8 s8 g8 g8 | % 9
  s8 g8 cis'8~ cis'4. | % 10
  s2. | % 11
  } }
  s2. | % 12
  s2. | % 13
  s2. | % 14
  s2. | % 15
  s2. | % 16
  s2. | % 17
  s2. | % 18
  s2. | % 19
  s2. | % 20
  s2. | % 21
  s2. | % 22
  s2. | % 23
  s2. | % 24
  s2. | % 25
  s2. | % 26
  s2. | % 27
}
bass = \fixed c {
  \repeat volta 2 {
  g,4. a,4. | % 1
  b,2. | % 2
  g,4. a,4. | % 3
  b,2. | % 4
  c4. b,4. | % 5
  } \alternative { {
  ais,4. b,4. | % 6
  a,4. g,4. | % 7
  fis,4. r4 r8 | % 8
  } {
  ais,4. b,4. | % 9
  cis4. d4. | % 10
  g8 d8 b,8 g,4 r8 | % 11
  } }
  fis8 d8 d8 g8 d8 d8 | % 12
  gis8 d8 d8 a8 d8 d8 | % 13
  g8 d8 d8 a8 d8 d8 | % 14
  ais8 d8 d8 b8 d8 d8 | % 15
  c'8 d8 d8 b8 d8 d8 | % 16
  a8 d8 d8 g8 d8 d8 | % 17
  a8 d8 d8 g8 d8 a8 | % 18
  g8 d8 d8 fis8 d8 d8 | % 19
  fis8 d8 d8 g8 d8 d8 | % 20
  r8 f4 a8 d8 d8 | % 21
  g8 d8 d8 a8 d8 d8 | % 22
  ais8 d8 d8 b8 d8 d8 | % 23
  b8 d8 d8 g8 d8 b8 | % 24
  a8 d8 d8 fis8 d8 a8 | % 25
  g8 d8 d8 d8 d8 d8 | % 26
  fis8 d8 d8 d4. | % 27
}
\score { \context Staff <<
  \time 6/8 \clef "treble_8" \key g \major
  \context Voice = "upper" { \upper }
  \context Voice = "inner" { \inner }
  \context Voice = "bass" { \bass }
>> }
