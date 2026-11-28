\version "2.19.35"
% Sor, Op. 44 n.º 13. París, chez l’auteur et Pacini, IMSLP #837753 p. 7.
% Cotejo: París #470296 p. 14. Alturas sonantes.
upper = \fixed c {
  \tempo "Allegretto"
  \segno
  s8 \acciaccatura { fis'16 } e'16 dis'16 e'8 |
  s8 e'16 fis'16 g'8 |
  fis'8 b8 fis'8 |
  a'16 g'16 fis'16 g'16 e'8 |
  s8 \acciaccatura { fis'16 } e'16 dis'16 e'8 |
  s8 e'16 fis'16 g'8 |
  e'8 c'8 ais8 |
  b8 b8 b8 \bar ":|." |

  \repeat volta 4 {
    b8 a'16 gis'16 a'8 |
    b8 g'16 fis'16 g'8 |
    b8 fis'8 e'8 |
    e'8 dis'8 b8 |
    b8 a'16 gis'16 a'8 |
    b8 \acciaccatura { a'16 } g'16 fis'16 g'8 |
    fis'4 dis'8 |
  }
  \alternative {
    { <g e'>8 r8 b8 | }
    { <g e'>4 r8 ^"Fin." \bar "|." | }
  }

  \key e \major
  \repeat volta 4 {
    s8 gis'16( fis'16) e'8 |
    s8 a'16 gis'16 fis'8 |
    s8 b'8 a'8 |
    a'8( gis'8) e'8 |
    s8 gis'16( fis'16) e'8 |
    s8 a'16 gis'16 fis'8 |
    s8 b'8 <a dis'>8 |
    <gis e'>4 r8 ^"D.S. al Fin." |
  }
}
lower = \fixed c {
  <g b>4. |
  <g b>4. |
  <dis a>4. |
  g4. |
  <g b>4. |
  <g b>4. |
  e8 c8 ais,8 |
  b,4. |

  r8 fis'16 f'16 fis'8 |
  r8 e'16 dis'16 e'8 |
  r8 <b, a>8 <b, g>8 |
  <b, fis>4. |
  r8 fis'16 f'16 fis'8 |
  r8 e'16 dis'16 e'8 |
  <a c'>4 a8 |
  s4. |
  s4. |

  <gis b>4. |
  <a cis'>4. |
  <b dis'>4. |
  b4. |
  <gis b>4. |
  <a cis'>4. |
  <b dis'>4 s8 |
  s4. |
}
bass = \fixed c {
  e,4. | e,4. | s4. | e,4. |
  e,4. | e,4. | s4. | s4. |

  \repeat unfold 6 { s4. | }
  s8 a,8 b,8 |
  e,4 r8 |
  e,8 e,8 e,8 |

  \repeat unfold 6 { e,4. | }
  e,4 s8 |
  e,8 e,8 e,8 |
}
\score { \context Staff <<
  \time 3/8 \clef "treble_8" \key e \minor
  \context Voice = "upper" { \upper }
  \context Voice = "lower" { \lower }
  \context Voice = "bass" { \bass }
>> }
