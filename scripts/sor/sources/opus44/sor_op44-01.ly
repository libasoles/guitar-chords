\version "2.19.35"
% Sor, Op. 44 n.º 1. París, chez l’auteur et Pacini, IMSLP #837753 p. 2.
% Cotejo: París #470296 p. 2. Alturas sonantes; sin digitación moderna.
upper = \fixed c {
  \tempo "Andante"
  \partial 4 e'4 | % 0
  c'4 g4 e4 c4 | % 1
  b,8 d8 g8 b8 d'4 f'4 | % 2
  d'4 b4 g4 f4 | % 3
  e8 g8 c'8 e'8 g'4 g4 | % 4
  a4 c'4 d'4 f'4 | % 5
  g4 b4 c'4 e'4 | % 6
  d'4 a4 d'4 c'4 | % 7
  c'8( b8) a8 g8 s4 e'4 | % 8
  c'4 g4 e4 c4 | % 9
  b,8 d8 g8 b8 d'4 f'4 | % 10
  d'4 b4 g4 f4 | % 11
  e8 g8 c'8 e'8 g'4 g4 | % 12
  a4 s4 b4 s4 | % 13
  c'4 s4 d'4 s4 | % 14
  e'4 c'4 d'4 b4 | % 15
  c'4 g4 s4 e'4 | % 16
  d'4 g4 g'4 b4 | % 17
  c'4 e'4 a4 c'4 | % 18
  fis4 a4 d4 d'4 | % 19
  c'4 <g b>4 s4 d'4 | % 20
  b4 g4 s4 g'4 | % 21
  e'4 g4 s4 e'8 c'8 | % 22
  b4 d'4 c'4 a4 | % 23
  g4 d4 s4 e'4 | % 24
  c'4 g4 e4 c4 | % 25
  b,8 d8 g8 b8 d'4 f'4 | % 26
  d'4 b4 g4 f4 | % 27
  e8 g8 c'8 e'8 g'4 g4 | % 28
  a4 s4 b4 s4 | % 29
  c'4 s4 d'4 s4 | % 30
  e'4 c'4 d'4 b4 | % 31
  \grace { c'8 } <e g>4 s2. | % 32
}
bass = \fixed c {
  s4 | % 0
  s1 | % 1
  s1 | % 2
  s1 | % 3
  s1 | % 4
  s1 | % 5
  s1 | % 6
  s1 | % 7
  s2 g,4 s4 | % 8
  s1 | % 9
  s1 | % 10
  s1 | % 11
  s1 | % 12
  s4 c4 s4 d4 | % 13
  s4 e4 s4 f4 | % 14
  c4 e4 f4 g4 | % 15
  c4 s4 c4 s4 | % 16
  s1 | % 17
  s1 | % 18
  s1 | % 19
  s2 g,4 s4 | % 20
  s2 d4 s4 | % 21
  s2 c4 s4 | % 22
  d4 s2. | % 23
  s2 g,4 s4 | % 24
  s1 | % 25
  s1 | % 26
  s1 | % 27
  s1 | % 28
  s4 c4 s4 d4 | % 29
  s4 e4 s4 f4 | % 30
  c4 a4 f4 g4 | % 31
  c2 c2 | % 32
}
\score { \context Staff <<
  \time 4/4 \clef "treble_8" \key c \major
  \context Voice = "upper" { \upper }
  \context Voice = "bass" { \bass }
>> }
