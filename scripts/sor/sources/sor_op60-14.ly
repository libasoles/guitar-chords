\version "2.19.35"

% Fernando Sor, 25 Progressive Studies, Op. 60, No. 14 (Andante, E minor).
% Transcrito a mano del escaneo de dominio publico (IMSLP, Gitarrefreund Munchen 1915-17, Nos. 13-16) y cotejado
% con la edicion de Paris (IMSLP, Sor_op.60.pdf). Alturas absolutas que suenan (la guitarra escribe una octava mas alta).
% Sin digitacion.

\header {
  title = "25 Progressive Studies"
  subtitle = "Opus 60"
  piece = "No. 14"
  composer = "Fernando Sor"
}

upper = \fixed c {
  \tempo "Andante"
  \repeat volta 2 {
    b4 e'4 b4 |
    \acciaccatura d'8 c'4 b4 r4 |
    b4 fis'4 a4 |
    a4 g4 r4 |
    b4 e'4 b4 |
    \acciaccatura d'8 c'4 b4 e'4~ |
    e'4 g4 a4 |
  }
  \alternative {
    { <dis b>2 s4 | }
    { <dis b>2 s4 | }
  }
  \repeat volta 2 {
    r4 e'4 e'4 |
    e'4 d'4 c'4 |
    b4 f'4 e'8 b8 |
    d'2 c'4 |
    <a c'>4 <a c'>4 <a c'>4 |
    <a b>2 <g~ b>4 |
    <g e'>4 <g e'>4 <g e'>4 |
    <fis dis'>4 b2 |
    b4 e'4 b4 |
    \acciaccatura d'8 c'4 b4 r4 |
    b4 fis'4 a4 |
    a4 g4 r4 |
    b4 e'4 b4 |
    d'4 c'4 r4 |
    b8. e'16 g'4 fis'4 |
    e'2 r4 |
  }
}

inner = \fixed c {
  \repeat volta 2 {
    g2 g4 |
    a4 g4 e4 |
    s2. |
    s2. |
    g2 g4 |
    a4 g4 s4 |
    r4 e4 fis4 |
  }
  \alternative {
    { s2. | }
    { s2. | }
  }
  \repeat volta 2 {
    b2. |
    c'4 b4 a4 |
    r8 a4 a8 <e gis>4 |
    r8 e8 gis8 e8 a4 |
    s2. |
    dis4 b,4 e8 d8 |
    s2. |
    s4 r4 a4 |
    g2 g4 |
    a4 g4 e4 |
    s2. |
    s2. |
    g2 gis4~ |
    gis8 gis8 a4 s4 |
    g4 b4 <dis a>4 |
    g2 s4 |
  }
}

bass = \fixed c {
  \repeat volta 2 {
    e,2. |
    e,2 s4 |
    dis2. |
    e2 s4 |
    e,2. |
    e,2 r4 |
    c2. |
  }
  \alternative {
    { r8 b,4 a,8 g,8 fis,8 | }
    { r4 b,4 a,4 | }
  }
  \repeat volta 2 {
    gis,2. |
    a,2. |
    d2 s4 |
    s2. |
    a,4 c4 e4 |
    s2. |
    c4 b,4 ais,4 |
    b,4 r4 r4 |
    e,2.~ |
    e,2 s4 |
    dis2. |
    e2. |
    e,2. |
    a,2 a,4 |
    g,2 s4 |
    e4 e,4 s4 |
  }
}

\score {
  \context Staff <<
    \time 3/4
    \clef "treble_8"
    \key e \minor
    \context Voice = "upper" { \upper }
    \context Voice = "inner" { \inner }
    \context Voice = "bass" { \bass }
  >>
}
