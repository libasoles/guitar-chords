\version "2.19.35"
% Transcripción: París, chez l’auteur, ca. 1837, IMSLP #836891.
% Alturas que suenan; plicas independientes conservadas; sin digitación añadida.
upper = \fixed c {
  \tempo "Andante cantabile"
  \repeat volta 2 { <fis d'>4 <fis d'>8 e'8. fis'16 e'8 | % 1
  <fis d'>8 r16 a'16 d''16 e''16 fis''8 d''8 a''8 | % 2
  <cis' e'>4 e'8 d'8. e'16 d'8 | % 3
  cis'8 r16 a'16 cis''16 d''16 e''8 cis''8 a'8 | % 4
  <fis d'>4 <fis d'>8 <g cis' e'>8. fis'16 e'8 | % 5
  d'8 r16 cis''16 d''16 e''16 fis''8 d''8 b'8 | % 6
  cis'4 cis'8 e'8. d'16 b8 | % 7
  a8 r8 <cis'' e''>8 a''8 r4 } | % 8
  \repeat volta 2 { <cis' e'>4 <cis' e'>8 <cis' e'>8. fis'16 e'8 | % 9
  <fis d'>8 r16 a'16 d''16 e''16 fis''16 cis''16 d''16 fis''16 a''8 | % 10
  <cis' e'>4 <cis' e'>8 a'8 g'8 e'8 | % 11
  <fis d'>16 a'16 b'16 cis''16 d''16 e''16 fis''16 cis''16 d''16 fis''16 a''8 | % 12
  fis'4 fis'8 \grace { g'8 } fis'8. e'16 fis'8 | % 13
  <g b g'>16 d''16 cis''16 d''16 e''16 fis''16 g''16 d''16 g''16 b''16 d'''8 | % 14
  <a fis'>4 fis'8 e'8. fis'16 e'8 | % 15
  <fis d'>8 fis''16 d''16 a'16 fis'16 d'4. } | % 16
}
inner = \fixed c {
  s4. <g cis'>4. | % 1
  s2. | % 2
  g4 g8 fis4 fis8 | % 3
  e8 s8 s2 | % 4
  s2. | % 5
  fis8 s8 s2 | % 6
  <e a>4. gis4. | % 7
  s2. | % 8
  g4 g8 g4. | % 9
  s2. | % 10
  g4 g8 <g cis'>4. | % 11
  s2. | % 12
  <a c'>4 s8 <a c'>4. | % 13
  s2. | % 14
  s4 a8 gis4 <g cis'>8 | % 15
  s2. | % 16
}
bass = \fixed c {
  d,4. a,4. | % 1
  d,8 s8 s2 | % 2
  a,4 a,8 a,4 a,8 | % 3
  a,8 s8 s2 | % 4
  d,4. a,4 ais,8 | % 5
  b,8 s8 s2 | % 6
  s4. e,4. | % 7
  a,8 s8 s2 | % 8
  a,4 a,8 a,4.~ | % 9
  a,8 s8 s2 | % 10
  a,4 a,8 a,4. | % 11
  d,16 s16 s8 s2 | % 12
  r8 d8 d8 d4. | % 13
  s2. | % 14
  r8 a,4 r4. | % 15
  d,8 s8 s2 | % 16
}
\score { \context Staff <<
  \time 6/8 \clef "treble_8" \key d \major
  \context Voice = "upper" { \upper }
  \context Voice = "inner" { \inner }
  \context Voice = "bass" { \bass }
>> }
