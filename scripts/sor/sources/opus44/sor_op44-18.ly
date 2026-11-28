\version "2.19.35"
% Sor, Op. 44 n.º 18. París, chez l’auteur et Pacini, IMSLP #837753 p. 10.
% Cotejo: París #470296 p. 19. Alturas sonantes.
upper = \fixed c {
  \tempo "Marche"

  d'4 a8. a16 d'4 <d' fis'>4 |
  <fis' a'>4 a'4 d''4 fis''4 |
  <fis' a'>4 <d' fis'>8. fis'16 d'4 <d' fis'>4 |
  <cis' e'>4 a'4 a'4 a'4 |
  d'4 a8. a16 d'4 <d' fis'>4 |
  <fis' a'>4 a'4 d''4 fis''4 |
  e'4 a'8. a'16 <b gis'>4 <d' b'>4 |
  <cis' a'>4 a'4 a4 r4 \bar ":|." |

  \bar ".|:" <fis' a'>4 <fis' a'>8. b'16 a'4 <dis' fis'>4 |
  <e' g'>4 a'8. cis''16 e''4 <cis' g'>4 |
  <d' fis'>4 <fis' a'>4 <e' g'>4 <d' fis'>4 |
  <cis' e'>4 a'8. a'16 a'4 a'4 |
  <fis' a'>4 fis''8. d''16 a'4 <fis' a'>4 |
  <e' g'>4 e''8. cis''16 a'4 <e' g'>4 |
  <d' fis'>4 a'4 fis'4 d'4 |
  a'4 a8. a16 a4 r4 |
  d'4 a8. a16 d'4 <a fis'>4 |

  d'4 a8. a16 d'4 <a fis'>4 |
  s4 d'4 <g cis' e'>4 <a c' fis'>4 |
  <g b g'>4 g,4 <d'' g'' b''>2 |
  <e' g'>4 <g' cis''>8. <g' cis''>16 cis''4 <g' cis''>4 |
  <fis' d''>4 <fis' a'>2 <d' fis'>4 |
  e'4 fis'8. g'16 b4 <g cis'>4 |
  <d fis d'>4 <fis d'>4 <d fis d'>4 r4 \bar ":|." |
}
lower = \fixed c {
  d4 r4 fis4 s4 |
  s1 |
  d2 fis4 d4 |
  a,4 s2. |
  d4 fis2. |
  s1 |
  a,2 e,2 |
  a,4 s2. |

  a,1 |
  a,4 s2. |
  a,4 r4 a,4 r4 |
  a,4 a4 a4 a4 |
  a,1 |
  a,4 s2. |
  s4 a4 fis4 d4 |
  a4 a,4 a,4 s4 |
  d1 |

  d1 |
  d4 fis4 s2 |
  s1 |
  a,2. a,4 |
  d2 d2 |
  <g b>2 r4 a,4 |
  s4 a,4 s2 |
}
inner = \fixed c {
  \repeat unfold 6 { s1 | }
  cis'2 s2 |
  \repeat unfold 16 { s1 | }
}
\score { \context Staff <<
  \time 4/4 \clef "treble_8" \key d \major
  \context Voice = "upper" { \upper }
  \context Voice = "lower" { \lower }
  \context Voice = "inner" { \inner }
>> }
