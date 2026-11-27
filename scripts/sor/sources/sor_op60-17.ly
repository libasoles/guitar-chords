\version "2.19.35"
% Transcripción: París, chez l’auteur, ca. 1837, IMSLP #836891.
% Fuente: #836891, p. 11; cotejo con #43476, p. 1, y París #470312, p. 19.
% Alturas que suenan; plicas independientes conservadas; sin digitación añadida.
upper = \fixed c {
  \tempo "Allegro moderato"
  c16 c'16 e16 g16 f16 a16 e16 g16 | % 1
  c16 c'16 e16 g16 f16 a16 e16 g16 | % 2
  c16 g16 e16 c'16 g16 e'16 c'16 e'16 | % 3
  g'16( f'16) d'16 b16 g8. b16 | % 4
  c16 c'16 e16 g16 f16 a16 e16 g16 | % 5
  c16 c'16 e16 g16 f16 a16 e16 g16 | % 6
  f16 a16 d16 c'16 g16 b16 f16 d'16 | % 7
  e16 c'16 g16 e'16 c8 r8 | % 8
  c'16 e'16 g16 c'16 e16 g16 c16 g16 | % 9
  b,16 f'16 g16 d'16 g,16 f'16 g16 b16 | % 10
  c'16 e'16 g16 c'16 e16 g16 c16 g16 | % 11
  b,16 f'16 g16 d'16 g,16 f'16 g16 b16 | % 12
  c16 e'16 g16 c'16 a16 e'16 c16 e'16 | % 13
  d16 fis'16 a16 c'16 e16 g'16 g16 b16 | % 14
  c16 g'16 a16 c'16 a,16 g'16 d16 fis'16 | % 15
  g16 g'16 d16 b16 g,8 g8 | % 16
  g,16 f'16 d16 b16 g16 f'16 g,16 b16 | % 17
  c16 e'16 e16 c'16 g16 e'16 c16 c'16 | % 18
  b,16 f'16 d16 f'16 g16 f'16 b,16 f'16 | % 19
  c16 e'16 g16 c'16 e16 c'16 c16 e'16 | % 20
  a,16 g'16 e16 cis'16 a16 cis'16 a,16 g'16 | % 21
  d16 fis'16 a16 d'16 a16 d'16 d16 fis'16 | % 22
  g,16 f'16 b16\3 d'16 b16\3 d'16 g,16 f'16 | % 23
  c16 e'16 g16 c'16 e16 c'16 c16 e'16 | % 24
  a,16 e'16 e16 c'16 a16 c'16 a,16 e'16 | % 25
  f,16 d'16 f16 a16 f16 a16 f,16 d'16 | % 26
  g,16 c'16 e16 g16 d16 b16 f16 g16 | % 27
  c16 c'16 e16 g16 c8 r8 | % 28
}
inner = \fixed c {
  s8 e8 f8 e8 | % 1
  s8 e8 f8 e8 | % 2
  s2 | % 3
  s2 | % 4
  s8 e8 f8 e8 | % 5
  s8 e8 f8 e8 | % 6
  s2 | % 7
  s2 | % 8
  s2 | % 9
  s2 | % 10
  s2 | % 11
  s2 | % 12
  s8 g8 a4 | % 13
  s2 | % 14
  s2 | % 15
  s2 | % 16
  s8 d8 g4 | % 17
  s8 e8 g4 | % 18
  s8 d8 g4 | % 19
  s8 g8 e4 | % 20
  s8 e8 a4 | % 21
  s8 a8 a4 | % 22
  s8 b8\3 b4\3 | % 23
  s2 | % 24
  s8 e8 a4 | % 25
  s8 f8 f4 | % 26
  s8 e8 d8 f8 | % 27
  s2 | % 28
}
bass = \fixed c {
  c2 | % 1
  c2 | % 2
  c8 e8 g4~ | % 3
  g4 r16 f16 d8 | % 4
  c2 | % 5
  c2 | % 6
  f8 d8 g8 f8 | % 7
  e8 g8 s4 | % 8
  c'8 g8 e8 c8 | % 9
  b,4 g,8 g8 | % 10
  c'8 g8 e8 c8 | % 11
  b,4 g,4 | % 12
  c4. c8 | % 13
  d4 e4 | % 14
  c4 a,8 d8 | % 15
  g8 d8 g,4 | % 16
  g,4. g,8 | % 17
  c4. c8 | % 18
  b,4. b,8 | % 19
  c4. c8 | % 20
  a,4. a,8 | % 21
  d4. d8 | % 22
  g,4. g,8 | % 23
  c8 g8 e8 c8 | % 24
  a,4. a,8 | % 25
  f,4. f,8 | % 26
  g,2 | % 27
  c4 s4 | % 28
}
\score { \context Staff <<
  \time 2/4 \clef "treble_8" \key c \major
  \context Voice = "upper" { \upper }
  \context Voice = "inner" { \inner }
  \context Voice = "bass" { \bass }
>> }
