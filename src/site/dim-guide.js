/* dim-guide.js — Data for the "acordes disminuidos" page: three movable
   dim7 shapes (root on the 6th, 5th and 4th string), one voicing per root.
   A fully-diminished 7th chord repeats every minor third, so each shape is
   just the same fingering pattern slid up the neck — computed once from the
   chord's root pitch class and the open-string tuning, then hand-verified.
   The 4th-string-root shape reuses the voicings already in chords-db.js. */
(function () {
  'use strict';

  // Root on the 6th string. Pattern: strings 6 and 3 share the higher fret,
  // strings 4 and 2 share the lower fret (index finger flat across both);
  // strings 5 and 1 are muted.
  var ROOT_STRING_6 = [
    { name: 'Cdim7', fingers: [[6,8,'2'],[5,'x'],[4,7,'1'],[3,8,'3'],[2,7,'1'],[1,'x']], barres: [], position: 7 },
    { name: 'D♭dim7', fingers: [[6,9,'2'],[5,'x'],[4,8,'1'],[3,9,'3'],[2,8,'1'],[1,'x']], barres: [], position: 8 },
    { name: 'Ddim7', fingers: [[6,10,'2'],[5,'x'],[4,9,'1'],[3,10,'3'],[2,9,'1'],[1,'x']], barres: [], position: 9 },
    { name: 'E♭dim7', fingers: [[6,11,'2'],[5,'x'],[4,10,'1'],[3,11,'3'],[2,10,'1'],[1,'x']], barres: [], position: 10 },
    { name: 'Edim7', fingers: [[6,12,'2'],[5,'x'],[4,11,'1'],[3,12,'3'],[2,11,'1'],[1,'x']], barres: [], position: 11 },
    { name: 'Fdim7', fingers: [[6,13,'2'],[5,'x'],[4,12,'1'],[3,13,'3'],[2,12,'1'],[1,'x']], barres: [], position: 12 },
    { name: 'F♯dim7', fingers: [[6,2,'2'],[5,'x'],[4,1,'1'],[3,2,'3'],[2,1,'1'],[1,'x']], barres: [], position: 1 },
    { name: 'Gdim7', fingers: [[6,3,'2'],[5,'x'],[4,2,'1'],[3,3,'3'],[2,2,'1'],[1,'x']], barres: [], position: 2 },
    { name: 'A♭dim7', fingers: [[6,4,'2'],[5,'x'],[4,3,'1'],[3,4,'3'],[2,3,'1'],[1,'x']], barres: [], position: 3 },
    { name: 'Adim7', fingers: [[6,5,'2'],[5,'x'],[4,4,'1'],[3,5,'3'],[2,4,'1'],[1,'x']], barres: [], position: 4 },
    { name: 'B♭dim7', fingers: [[6,6,'2'],[5,'x'],[4,5,'1'],[3,6,'3'],[2,5,'1'],[1,'x']], barres: [], position: 5 },
    { name: 'Bdim7', fingers: [[6,7,'2'],[5,'x'],[4,6,'1'],[3,7,'3'],[2,6,'1'],[1,'x']], barres: [], position: 6 },
  ];

  // Root on the 5th string. Pattern: strings 3 and 1 share the lower fret
  // (index finger flat across both), string 5 (root) sits one fret above,
  // string 2 sits two frets above; strings 6 and 4 are muted.
  var ROOT_STRING_5 = [
    { name: 'Cdim7', fingers: [[6,'x'],[5,3,'2'],[4,'x'],[3,2,'1'],[2,4,'3'],[1,2,'1']], barres: [], position: 2 },
    { name: 'D♭dim7', fingers: [[6,'x'],[5,4,'2'],[4,'x'],[3,3,'1'],[2,5,'3'],[1,3,'1']], barres: [], position: 3 },
    { name: 'Ddim7', fingers: [[6,'x'],[5,5,'2'],[4,'x'],[3,4,'1'],[2,6,'3'],[1,4,'1']], barres: [], position: 4 },
    { name: 'E♭dim7', fingers: [[6,'x'],[5,6,'2'],[4,'x'],[3,5,'1'],[2,7,'3'],[1,5,'1']], barres: [], position: 5 },
    { name: 'Edim7', fingers: [[6,'x'],[5,7,'2'],[4,'x'],[3,6,'1'],[2,8,'3'],[1,6,'1']], barres: [], position: 6 },
    { name: 'Fdim7', fingers: [[6,'x'],[5,8,'2'],[4,'x'],[3,7,'1'],[2,9,'3'],[1,7,'1']], barres: [], position: 7 },
    { name: 'F♯dim7', fingers: [[6,'x'],[5,9,'2'],[4,'x'],[3,8,'1'],[2,10,'3'],[1,8,'1']], barres: [], position: 8 },
    { name: 'Gdim7', fingers: [[6,'x'],[5,10,'2'],[4,'x'],[3,9,'1'],[2,11,'3'],[1,9,'1']], barres: [], position: 9 },
    { name: 'A♭dim7', fingers: [[6,'x'],[5,11,'2'],[4,'x'],[3,10,'1'],[2,12,'3'],[1,10,'1']], barres: [], position: 10 },
    { name: 'Adim7', fingers: [[6,'x'],[5,12,'2'],[4,'x'],[3,11,'1'],[2,13,'3'],[1,11,'1']], barres: [], position: 11 },
    { name: 'B♭dim7', fingers: [[6,'x'],[5,13,'2'],[4,'x'],[3,12,'1'],[2,14,'3'],[1,12,'1']], barres: [], position: 12 },
    { name: 'Bdim7', fingers: [[6,'x'],[5,2,'2'],[4,'x'],[3,1,'1'],[2,3,'3'],[1,1,'1']], barres: [], position: 1 },
  ];

  // Root on the 4th string — reuses the voicings already in chords-db.js.
  // Ddim7 is overridden: chords-db uses an open-position voicing there
  // (D falls on fret 0 in this shape), which breaks the "same movable
  // shape, different fret" pattern this section is demonstrating.
  var ROOT_STRING_4 = [
    'Cdim7', 'D♭dim7',
    { name: 'Ddim7', fingers: [[6,'x'],[5,'x'],[4,12,'1'],[3,13,'2'],[2,12,'1'],[1,13,'3']], barres: [], position: 12 },
    'E♭dim7', 'Edim7', 'Fdim7',
    'F♯dim7', 'Gdim7', 'A♭dim7', 'Adim7', 'B♭dim7', 'Bdim7',
  ];

  window.DimGuidePage.render([
    { gridId: 'dimGrid6', chords: ROOT_STRING_6 },
    { gridId: 'dimGrid5', chords: ROOT_STRING_5 },
    { gridId: 'dimGrid4', chords: ROOT_STRING_4 },
  ]);
})();
