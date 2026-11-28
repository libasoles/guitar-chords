\version "2.19.35"
% Sor, Op. 44 n.º 3. París, chez l’auteur et Pacini, IMSLP #837753 p. 3.
% Cotejo: París #470296 p. 4. Alturas sonantes.
upper = \fixed c {
  \tempo "Andantino"
  e4 g4 c'4 |
  c'4( b4) d'4 |
  c'4 g4 e'4 |
  d'2. |
  c'4 e'4 g'4 |
  a4 d'4 f'4 |

  b4 c'4 e'4 |
  d'4. b8 g4 |
  g4 e4 c'4 |
  c'4( b8) g8 d'4 |
  d'8( c'8) g8 c'8 e'4 |
  d'2 dis'4 |
  e'4 b4 c'4 |

  a4 d'4 e'4 |
  f'4 a4 b4 |
  c'2 r4 |
  d'4 g4 g4 |
  g4 e'2 |
  e'4 d'4 a4 |
  c'4 b8 d8 g8 b8 |

  d'4 g4 g'4~ |
  g'4 fis'8 e'8 c'8 a8 |
  g8 b8 d'8 c'8 a8 fis8 |
  g2 f4 |
  e4 g4 c'4 |
  c'8( b8) g4 d'4 |
  d'8( c'8) g4 e'4 |

  d'2. |
  c'4 e'4 g'4 |
  a4 f'8( e'8) d'8 c'8 |
  b4 c'4 e'4 |
  d'4. b8 g4 |
  g4 e4 c'4 |
  c'4( b8 g8) b8 d'8 |

  d'4 c'8 g8 c'8 e'8 |
  d'2 dis'4 |
  e'4 b4 c'4 |
  a8 b8 c'8 cis'8 d'8 e'8 |
  g'8 f'8 a4 b4 |
  c'2. \bar "|." |
}
bass = \fixed c {
  c2. |
  d2 f4 |
  e2 c4 |
  b,4 g4 f4 |
  e2. |
  f2. |

  g8 f8 e4 c4 |
  g4 g,2 |
  c2. |
  d2 f4 |
  e2 c4 |
  b,4 g2 |
  c4 d4 e4 |

  f2 e4 |
  d2 g4 |
  c4 e8 g8 c4 |
  b,2. |
  c4. b,8 a,8 g,8 |
  fis,2. |
  g,2 r8 s8 |

  b,2. |
  c2. |
  d2 r8 s8 |
  r4 g,2 |
  c2 s4 |
  d2 f4 |
  e2 c4 |

  b,4 g4 f4 |
  e2. |
  f2. |
  g8 f8 e4 c4 |
  b,4 g,4 r8 s8 |
  c2. |
  d2 f4 |

  e2 c4 |
  b,4 g2 |
  c4 d4 e4 |
  f2. |
  d2 g4 |
  c8 g8 e8 g8 c4 |
}
\score { \context Staff <<
  \time 3/4 \clef "treble_8" \key c \major
  \context Voice = "upper" { \upper }
  \context Voice = "bass" { \bass }
>> }
