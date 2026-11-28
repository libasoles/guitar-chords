\version "2.19.35"
% Sor, Op. 44 n.º 21. París, chez l’auteur et Pacini, IMSLP #837753 p. 11.
% Cotejo: París #470296 p. 22. Alturas sonantes.
upper = \fixed c {
  \tempo "Andante"
  e'4 a'4 gis'4 |
  \acciaccatura { gis'16 } <d' fis'>4 <cis' e'>4 <a cis'>4 |
  d'4~ \tuplet 3/2 { d'8 cis'8 d'8 } \tuplet 3/2 { <gis b>8 fis'8 e'8 } |
  <b d'>4 <a cis'>4 r4 |
  e'4 a'4 gis'4 |
  gis'4 fis'8 dis'8 e'8 b8 |

  cis'8. e'16 b4 dis'4 |
  fis'4 e'4 r4 |
  e'8. fis'16 e'4 <ais cis'>4 |
  <b d'>2 <gis b>4 |
  <a cis'>4 <a cis'>4 <b d'>4 |
  <a cis'>2 <gis b>4 |
  <cis' e'>4 <d' fis'>4. <cis' e'>8 |

  <ais cis'>4 <b d'>4 <gis b>4 |
  cis'4.. e'16 dis'8. fis'16 |
  e'2 r4 |
  e'4 a'4 gis'4 |
  \acciaccatura { gis'16 } <d' fis'>4 e'4 cis'4 |
  d'4~ \tuplet 3/2 { d'8 cis'8 d'8 } \tuplet 3/2 { <gis b>8 fis'8 e'8 } |

  <b d'>4 <a cis'>8 r8 r4 |
  \tuplet 3/2 { g8 cis'8 e'8 } \tuplet 3/2 { a'8 a'8 a'8 } a'4 |
  \tuplet 3/2 { fis8 b8 fis'8 } \tuplet 3/2 { a'8 a'8 a'8 } a'4 |
  <cis' e'>4.. <a cis'>16 <b d'>8. <gis b>16 |
  a8 r8 <cis' a'>8 r4 r8 \bar ":|." |
}
lower = \fixed c {
  a,2. |
  a,2. |
  a,4 a,4 a,4 |
  a,4. a,8 e8 cis8 |
  a,4. cis8 e8 eis8 |
  <a fis>2 gis4 |

  ais,4 b,8 gis8 b,8 a8 |
  e,2. |
  e,2. |
  e,2. |
  e,2. |
  e,2. |
  e,2. |

  e,2. |
  e,2. |
  e,2. |
  a,2. |
  a,2. |
  a,4 a,4 a,4 |

  a,4~ \tuplet 3/2 { a,8 a,8 gis,8 } \tuplet 3/2 { a,8 cis8 e8 } |
  s2. |
  s2. |
  e8 s8 e,2 |
  a,8 s8 a,8 s4. |
}
inner = \fixed c {
  cis'2 b4 |
  s2. |
  fis2 s4 |
  s2. |
  cis'2 b4 |
  s2. |

  fisis4 s2 |
  a8 dis8 <e gis>8 e8 e8 e8 |
  cis'8 e8 e8 e8 e8 e8 |
  r8 e8 e8 e8 e8 e8 |
  a8 e8 e8 e8 e8 e8 |
  r8 e8 e8 e8 e8 e8 |
  r8 e8 e8 e8 e8 e8 |

  r8 e8 e8 e8 e8 e8 |
  a8 e8 e8 e8 <e a>8 e8 |
  gis8 e8 dis8 d8 cis8 b,8 |
  cis'2 b4 |
  s4 \tuplet 3/2 { cis'8 a8 a8 } \tuplet 3/2 { a8 gis8 g8 } |
  fis2 s4 |

  s2. |
  g2 \tuplet 3/2 { s8 cis'8 e'8 } |
  fis2 \tuplet 3/2 { f8 <c' dis'>8 <c' dis'>8 } |
  s2. |
  s2. |
}
\score { \context Staff <<
  \time 3/4 \clef "treble_8" \key a \major
  \context Voice = "upper" { \upper }
  \context Voice = "lower" { \lower }
  \context Voice = "inner" { \inner }
>> }
