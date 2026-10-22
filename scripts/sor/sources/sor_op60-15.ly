\version "2.19.35"

% Fernando Sor, 25 Progressive Studies, Op. 60, No. 15 (Allegro, E major, 6/8).
% Transcrito a mano del escaneo de dominio publico (IMSLP, Gitarrefreund Munchen 1915-17, Nos. 13-16) y cotejado
% con la edicion de Paris (IMSLP, Sor_op.60.pdf). Alturas absolutas que suenan (la guitarra escribe una octava mas alta).
% Las barras de repeticion sueltas (\bar ":|.") son las del original: los compases de acordes se tocan dos veces.
% Sin digitacion.

\header {
  title = "25 Progressive Studies"
  subtitle = "Opus 60"
  piece = "No. 15"
  composer = "Fernando Sor"
}

upper = \fixed c {
  \tempo "Allegro"
  r4 r8 <gis b>4. \bar ":|." |
  r4 r8 <a cis'>4. \bar ":|." |
  r4 r8 <a b>4. \bar ":|." |
  r4 r8 <gis b>4. \bar ":|." |
  e,8 b,8 e8 gis8 b8 e'8 |
  a,8 e8 a8 cis'8 e'8 cis'8 |
  b,8 dis8 a8 b8 fis'8 a8 |
  r4 r8 e'4 r8 \bar ":|." |
  \repeat volta 2 {
    fis8 dis'8 cis'8 b8 dis'8 fis'8 |
    fis'8 e'8 cis'8 ais8 cis'8 fis8 |
    b8 dis'8 fis8 b8 dis'8 fis'8~ |
    fis'8 cis'8 ais8 fis4 r8 |
    dis8 b8 fis'8 fis'4. |
    e8 b8 gis'8 gis'4. |
    fis8 ais8 cis'8 e'8 cis'8 ais8 |
    b4. s4 r8 |
    r4 r8 <gis b>4. \bar ":|." |
    r4 r8 <a cis'>4. \bar ":|." |
    r4 r8 <a b>4. \bar ":|." |
    r4 r8 <gis b e'>4. \bar ":|." |
    e,8 b,8 e8 gis8 b8 e'8 |
    a,8 e8 a8 cis'8 e'8 cis'8 |
    b,8 dis8 a8 b8 e'8 b8 |
    r4 r8 e'4 r8 |
  }
}

inner = \fixed c {
  s2. | s2. | s4. dis4. | s2. |
  s2. | s2. | s2. |
  s4. <e gis>4 s8 |
  \repeat volta 2 {
    s2. | s2. | s2. | s2. |
    s2. | s2. | s2. |
    s4. b,4 s8 |
    s2. | s2. | s4. dis4. | s2. |
    s2. | s2. | s2. |
    s4. <e gis>4 s8 |
  }
}

bass = \fixed c {
  e,2. | a,2. | b,2. | e2. |
  e,2. | a,2. | b,2. |
  e,4. s4. |
  \repeat volta 2 {
    fis2.~ | fis2.~ | fis2.~ | fis4. s4. |
    dis2. | e2. | fis2. |
    s2. |
    e,2. | a,2. | b,4. s4. | e2. |
    e,2. | a,2. | b,2. |
    e,4. s4. |
  }
}

\score {
  \context Staff <<
    \time 6/8
    \clef "treble_8"
    \key e \major
    \context Voice = "upper" { \upper }
    \context Voice = "inner" { \inner }
    \context Voice = "bass" { \bass }
  >>
}
