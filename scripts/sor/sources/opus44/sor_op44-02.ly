\version "2.12.2"
% Adaptación de Louie van Bommel, Mutopia-2009/06/08-1657, CC BY 3.0.
% https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1657
% Fuente: Guitar-Skole de A. Eggers. Cotejo: París, IMSLP #837753 p. 2.
% Se restituye Allegretto, se omiten dedos y acentos de Eggers y se liga el bajo 11–12.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%Start Music%%%%%%%%%%%%%%%

staffOneVoiceOneNotes =
{
  \key c \major 
  \time 2/4 
  \tempo "Allegretto"
  %1
  c'8 [g' e' c'']
  %2
  g'8 e''8 c''4 
  %3
  c'8 [g' e' c'']
  %4
  g'8 e''8 c''4 
  %5
  g'8 f''8 d''4 
  %6
  g'8 e''8 c''4 \break
  %7
  b'8 d''8 c''8 e''8 
  %8
  d''8 b'8 g'4 
  %9
  c'8 [g' e' c'']
  %10
  g'8 e''8 c''4 
  %11
  c'8 [g' e' c'']
  %12
  g'8 e''8 c''4 \break
  %13
  g'8 f''8 d''4 
  %14
  g'8 e''8 c''4 
  %15
  f'8 d''8 g'8 b'8 
  %16
  c''4 r4 
  %17
  g'8 b'8 d'8 b'8 
  %18
  a'8 c''8~ c''4 
  %19
  g'8 b'8 d'8 b'8 
  %20
  a'8 c''8~ c''4 
  %21
  g'8 b'8 b8 d''8 
  %22
  c'8 [e'' c'' a']
  %23
  d'8 [c''8 a'8 fis']
  %24
  g'2 
  %25
  c'8 [g' e' c'']
  %26
  g'8 e''8 c''4  \break
  %27
  c'8 [g' e' c''] 
  %28
  g'8 e''8 c''4 
  %29
  g'8 f''8 d''4 
  %30
  g'8 e''8 c''4 
  %31
  f'8 d''8 g'8 b'8 
  %32
  c''2 \bar "|."
}
staffOneVoiceTwoNotes =
{
  %1
  c'2~ 
  %2
  c'2 
  %3
  c'2~ 
  %4
  c'2 
  %5
  b2 
  %6
  c'2 
  %7
  g'2~ 
  %8
  g'2 
  %9
  c'2~ 
  %10
  c'2 
  %11
  c'2~  
  %12
  c'2 
  %13
  b2 
  %14
  c'2 
  %15
  f'4 g'4 
  %16
  e'8 g'8 c'4 
  %17
  g'4 d'4
  %18
  a'4 d'4 
  %19
  g'4 d'4 \break
  %20
  a'4 d'4 
  %21
  g'4 b4 
  %22
  c'2 
  %23
  d'4. r8 
  %24
  r8 g8 [a8 b8] 
  %25
  c'2~ 
  %26
  c'2
  %27
  c'2~ 
  %28
  c'2 
  %29
  b2 
  %30
  c'2 
  %31
  f'4 g'4 
  %32
  e'8 g'8 c'4 
}

\score { \context Staff <<
  \clef violin
  \context Voice = "upper" { \staffOneVoiceOneNotes }
  \context Voice = "bass" { \staffOneVoiceTwoNotes }
>> }
