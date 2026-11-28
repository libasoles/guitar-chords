\version "2.19.35"
% Sor, Op. 44 n.º 20. París, chez l’auteur et Pacini, IMSLP #837753 p. 11.
% Cotejo: París #470296 p. 21. Alturas sonantes.
upper = \fixed c {
  \tempo "Andantino"

  \partial 4 <a cis'>8 <b d'>8 |
  <bis dis'>8( <cis' e'>8) <cis' a'>8 <e' gis'>8 |
  <cis' f'>8( <d' fis'>8) <b d'>8 <a cis'>8 |
  <gis b>8 <a cis'>8 <b d'>8 <gis e'>8 |
  <b d'>8 <a cis'>8 <a cis'>8 <b d'>8 |
  <bis dis'>8( <cis' e'>8) a'8 fis'8 |
  <gis b dis'>8 fis'8 e'8 gis'8 |
  <cis' fis'>8 a'8 <a dis'>8 <a fis'>8 |
  \partial 4 <gis e'>8 r8 \bar ":|." |

  \partial 4 \bar ".|:" e'8 e'8 |
  b'8( gis'8) e'8 e'8 |
  e'8( a'8) e'8 e'8 |
  <b d'>8 e'8 <a cis'>8 e'8 |
  <b gis>4 e'8 e'8 |
  b'8( gis'8) e'8 e'8 |
  cis''8 a'8 e'8 e'8 |
  <bis dis'>8 <b d'>8 <ais cis'>8 <a c'>8 |
  <gis b>8 r8 <a cis'>8 <b d'>8 |
  <bis dis'>8( <cis' e'>8) a'8 <e' gis'>8 |
  <cis' f'>8( <d' fis'>8) <b d'>8 <a cis'>8 |
  <gis b>8 <a cis'>8 <b d'>8 <cis' e'>8 |
  <a cis'>8 e'8 <cis' a'>8 <e' gis'>8 |
  <d' fis'>4 <d' fis'>8 <d' fis'>8 |
  <d' e'>4 <cis' e'>8 a'8 |
  <d' fis'>8 <b d'>8 <gis b>8 e'8 |
  \partial 4 a8 r8 \bar ":|." |

  \partial 4 r4 \bar "|." |
}
lower = \fixed c {
  r8 s8 |
  a,2 |
  d2 |
  e4 e,4 |
  a,2 |
  a,4 <a cis'>8 <a cis'>8 |
  b4 <gis b>8 <e, b>8 |
  a,4 b,8 b,8 |
  e,8 s8 |

  r8 s8 |
  e,2 |
  e,2 |
  gis,4 a,4 |
  e,4 s4 |
  e,2 |
  e,2 |
  e,4 e,4 |
  e,8 r8 a,8 a,8 |
  a,2 |
  d2 |
  e4 e,4 |
  a,4 r4 |
  d8 cis8 b,8 a,8 |
  gis,8 e,8 a,4 |
  d4 e8 e,8 |
  a,8 s8 |

  s4 |
}
inner = \fixed c {
  s4 |
  \repeat unfold 7 { s2 | }
  s4 |
  s4 |
  d'2 |
  cis'2 |
  s2 |
  gis8 e8 r4 |
  d'2 |
  cis'2 |
  s2 |
  \repeat unfold 8 { s2 | }
  s4 |
  s4 |
}
\score { \context Staff <<
  \time 2/4 \clef "treble_8" \key a \major
  \context Voice = "upper" { \upper }
  \context Voice = "lower" { \lower }
  \context Voice = "inner" { \inner }
>> }
