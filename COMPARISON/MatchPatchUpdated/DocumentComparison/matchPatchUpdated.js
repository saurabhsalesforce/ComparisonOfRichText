export var diff_match_patch = function() {

    // Defaults.
    // Redefine these in your program to override the defaults.
  
    // Number of seconds to map a diff before giving up (0 for infinity).
    this.Diff_Timeout = 1.0;
    // Cost of an empty edit operation in terms of edit characters.
    this.Diff_EditCost = 4;
    // At what point is no match declared (0.0 = perfection, 1.0 = very loose).
    this.Match_Threshold = 0.5;
    // How far to search for a match (0 = exact location, 1000+ = broad match).
    // A match this many characters away from the expected location will add
    // 1.0 to the score (0.0 is a perfect match).
    this.Match_Distance = 1000;
    // When deleting a large block of text (over ~64 characters), how close do
    // the contents have to be to match the expected contents. (0.0 = perfection,
    // 1.0 = very loose).  Note that Match_Threshold controls how closely the
    // end points of a delete need to match.
    this.Patch_DeleteThreshold = 0.5;
    // Chunk size for context length.
    this.Patch_Margin = 4;
  
    // The number of bits in an int.
    this.Match_MaxBits = 32;
  };
  
    var DIFF_DELETE = -1;
    var DIFF_INSERT = 1;
    var DIFF_EQUAL = 0;

    

    diff_match_patch.Diff = function(op, text) {
        return [op, text];
    };
    diff_match_patch.Diff.prototype.length = 2;
    diff_match_patch.prototype.diff_main = function(text1, text2, opt_checklines, opt_deadline) {
      // Set a deadline by which time the diff must be complete.
      if (typeof opt_deadline == 'undefined') {
        if (this.Diff_Timeout <= 0) {
          opt_deadline = Number.MAX_VALUE;
        } else {
          opt_deadline = (new Date).getTime() + this.Diff_Timeout * 1000;
        }
      }
      var deadline = opt_deadline;
    
      // Check for null inputs.
      if (!Array.isArray(text1) || !Array.isArray(text2)) {
        throw new Error('Null input. (diff_main)');
      }
    
      // Check for equality (speedup).
      if (JSON.stringify(text1) === JSON.stringify(text2)) {
        if (text1) {
          return [new diff_match_patch.Diff(DIFF_EQUAL, text1)];
        }
        return [];
      }
    
      if (typeof opt_checklines == 'undefined') {
        opt_checklines = true;
      }
      var checklines = opt_checklines;
    
      // Trim off common prefix (speedup).
        var commonlength = this.diff_commonPrefix(text1, text2);
        var commonprefix = text1.slice(0, commonlength);
        text1 = text1.splice(commonlength);
        text2 = text2.splice(commonlength);
    
      // Trim off common suffix (speedup).
      commonlength = this.diff_commonSuffix(text1, text2);
      var commonsuffix = text1.slice(text1.length - commonlength);
      text1 = text1.slice(0, text1.length - commonlength);
      text2 = text2.slice(0, text2.length - commonlength);  
    
      // Compute the diff on the middle block.
      var diffs = this.diff_compute_(text1, text2, checklines, deadline);
      // Restore the prefix and suffix.
      if (commonprefix) {
        diffs.unshift(new diff_match_patch.Diff(DIFF_EQUAL, commonprefix));
      }
      if (commonsuffix) {
        diffs.push(new diff_match_patch.Diff(DIFF_EQUAL, commonsuffix));
      }
      this.diff_cleanupMerge(diffs);
      return diffs;
    };

    diff_match_patch.prototype.diff_compute_ = function(text1, text2, checklines, deadline) {
      var diffs;
      if (!text1.length) {
        return [new diff_match_patch.Diff(DIFF_INSERT, text2)];
      }
    
      if (!text2.length) {
        return [new diff_match_patch.Diff(DIFF_DELETE, text1)];
      }
      var longtext = text1.length > text2.length ? text1 : text2;
      var shorttext = text1.length > text2.length ? text2 : text1;
      var i = longtext.findIndex((item, index) => {
        if (index + shorttext.length > longtext.length) {
          return false;
        }
        for (var j = 0; j < shorttext.length; j++) {
          if (item !== shorttext[j]) {
            return false;
          }
          item = longtext[index + j + 1];
        }
        return true;
      });
      if (i !== -1) {
        diffs = [new diff_match_patch.Diff(DIFF_INSERT, longtext.slice(0, i)),
            new diff_match_patch.Diff(DIFF_EQUAL, shorttext),
            new diff_match_patch.Diff(DIFF_INSERT, longtext.slice(i + shorttext.length))
        ];
        if (text1.length > text2.length) {
            diffs[0][0] = diffs[2][0] = DIFF_DELETE;
        }
        return diffs;
      }
      if (shorttext.length === 1) {
        // Single character string.
        // After the previous speedup, the character can't be an equality.
        return [new diff_match_patch.Diff(DIFF_DELETE, text1),
                new diff_match_patch.Diff(DIFF_INSERT, text2)];
      }
    
      // Check to see if the problem can be split in two.
      var hm = this.diff_halfMatch_(text1, text2);
      if (hm) {
        // A half-match was found, sort out the return data.
        var text1_a = hm[0];
        var text1_b = hm[1];
        var text2_a = hm[2];
        var text2_b = hm[3];
        var mid_common = hm[4];
        // Send both pairs off for separate processing.
        var diffs_a = this.diff_main(text1_a, text2_a, checklines, deadline);
        var diffs_b = this.diff_main(text1_b, text2_b, checklines, deadline);
        // Merge the results.
        return diffs_a.concat([new diff_match_patch.Diff(DIFF_EQUAL, mid_common)],
                              diffs_b);
      }
    
      if (checklines && text1.length > 100 && text2.length > 100) {
        return this.diff_lineMode_(text1, text2, deadline);
      }
      return this.diff_bisect_(text1, text2, deadline);
    };

    diff_match_patch.prototype.diff_commonPrefix = function(text1, text2) {
        if (!text1 || !text2 || text1[0] != text2[0]) {
          return 0;
        }
        var pointermin = 0;
        var pointermax = Math.min(text1.length, text2.length);
        var pointermid = pointermax;
        var pointerstart = 0;
        while (pointermin < pointermid) {
          if (text1.slice(pointerstart, pointermid).join(' ') === text2.slice(pointerstart, pointermid).join(' ')) {
            pointermin = pointermid;
            pointerstart = pointermin;
          } else {
            pointermax = pointermid;
          }
          pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
        }
        return pointermid;
      };
      
    diff_match_patch.prototype.diff_commonSuffix = function(text1, text2) {
        if (!text1 || !text2 ||
            text1[text1.length - 1] !== text2[text2.length - 1]) {
          return 0;
        }
        var pointermin = 0;
        var pointermax = Math.min(text1.length, text2.length);
        var pointermid = pointermax;
        var pointerend = 0;
        while (pointermin < pointermid) {
          if (text1.slice(text1.length - pointermid, text1.length - pointerend).join('') ===
          text2.slice(text2.length - pointermid, text2.length - pointerend).join('')){
            pointermin = pointermid;
            pointerend = pointermin;
          } else {
            pointermax = pointermid;
          }
          pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
        }
        return pointermid;
      };

    diff_match_patch.prototype.diff_halfMatch_ = function(text1, text2) {
        if (this.Diff_Timeout <= 0) {
          // Don't risk returning a non-optimal diff if we have unlimited time.
          return null;
        }
        var longtext = text1.length > text2.length ? text1 : text2;
        var shorttext = text1.length > text2.length ? text2 : text1;
        if (longtext.length < 4 || shorttext.length * 2 < longtext.length) {
          return null;  // Pointless.
        }
        var dmp = this;  
        function diff_halfMatchI_(longtext, shorttext, i) {
          // Start with a 1/4 length substring at position i as a seed.
          var seed = longtext.slice(i, i + Math.floor(longtext.length / 4));
          var j = -1;
          var best_common = [];
          var best_longtext_a, best_longtext_b, best_shorttext_a, best_shorttext_b;
          function find_csa(arr, subarr, from_index) {
            var i = from_index >>> 0,
                sl = subarr.length,
                l = arr.length + 1 - sl;
        
            loop: for (; i<l; i++) {
                for (var j=0; j<sl; j++)
                    if (arr[i+j] !== subarr[j])
                        continue loop;
                return i;
            }
            return -1;
            }
            while ((j = find_csa(shorttext,seed, j + 1)) !== -1) {
            var prefixLength = dmp.diff_commonPrefix(longtext.slice(i),shorttext.slice(j));
            var suffixLength = dmp.diff_commonSuffix(longtext.slice(0, i),shorttext.slice(0, j));
            if (best_common.length < suffixLength + prefixLength) {
                best_common.push(...shorttext.slice(j - suffixLength, j));
                best_common.push(...shorttext.slice(j, j + prefixLength));
                best_longtext_a = longtext.slice(0, i - suffixLength);
                best_longtext_b = longtext.slice(i + prefixLength);
                best_shorttext_a = shorttext.slice(0, j - suffixLength);
                best_shorttext_b = shorttext.slice(j + prefixLength);
            }
            }
            if (best_common.length * 2 >= longtext.length) {
            return [best_longtext_a, best_longtext_b,
                    best_shorttext_a, best_shorttext_b, best_common];
            } else {
            return null;
            }
        }
      
        // First check if the second quarter is the seed for a half-match.
        var hm1 = diff_halfMatchI_(longtext, shorttext, Math.ceil(longtext.length / 4));
        // Check again based on the third quarter.
        var hm2 = diff_halfMatchI_(longtext, shorttext, Math.ceil(longtext.length / 2));
        var hm;
        if (!Array.isArray(hm1)&& !Array.isArray(hm2)) {
          return null;
        } else if (!Array.isArray(hm2)) {
          hm = hm1;
        } else if (!Array.isArray(hm1)) {
          hm = hm2;
        } else {
          // Both matched.  Select the longest.
          hm = hm1[4].length > hm2[4].length ? hm1 : hm2;
        }
      
        // A half-match was found, sort out the return data.
        var text1_a, text1_b, text2_a, text2_b;
        if (text1.length > text2.length) {
          text1_a = hm[0];
          text1_b = hm[1];
          text2_a = hm[2];
          text2_b = hm[3];
        } else {
          text2_a = hm[0];
          text2_b = hm[1];
          text1_a = hm[2];
          text1_b = hm[3];
        }
        var mid_common = hm[4];
        return [text1_a, text1_b, text2_a, text2_b, mid_common];
      };

    diff_match_patch.prototype.diff_bisect_ = function(text1, text2, deadline) {
    // Cache the text lengths to prevent multiple calls.
    var text1_length = text1.length;
    var text2_length = text2.length;
    var max_d = Math.ceil((text1_length + text2_length) / 2);
    var v_offset = max_d;
    var v_length = 2 * max_d;
    var v1 = new Array(v_length);
    var v2 = new Array(v_length);
    // Setting all elements to -1 is faster in Chrome & Firefox than mixing
    // integers and undefined.
    for (var x = 0; x < v_length; x++) {
      v1[x] = -1;
      v2[x] = -1;
    }
    v1[v_offset + 1] = 0;
    v2[v_offset + 1] = 0;
    var delta = text1_length - text2_length;
    // If the total number of characters is odd, then the front path will collide
    // with the reverse path.
    var front = (delta % 2 !== 0);
    // Offsets for start and end of k loop.
    // Prevents mapping of space beyond the grid.
    var k1start = 0;
    var k1end = 0;
    var k2start = 0;
    var k2end = 0;
    for (var d = 0; d < max_d; d++) {
      // Bail out if deadline is reached.
      if ((new Date()).getTime() > deadline) {
        break;
      }
  
      // Walk the front path one step.
      for (var k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
        var k1_offset = v_offset + k1;
        var x1;
        if (k1 === -d || (k1 !== d && v1[k1_offset - 1] < v1[k1_offset + 1])) {
          x1 = v1[k1_offset + 1];
        } else {
          x1 = v1[k1_offset - 1] + 1;
        }
        var y1 = x1 - k1;
        while (x1 < text1_length && y1 < text2_length &&
               text1[x1] == text2[y1]) {
          x1++;
          y1++;
        }
        v1[k1_offset] = x1;
        if (x1 > text1_length) {
          // Ran off the right of the graph.
          k1end += 2;
        } else if (y1 > text2_length) {
          // Ran off the bottom of the graph.
          k1start += 2;
        } else if (front) {
          var k2_offset = v_offset + delta - k1;
          if (k2_offset >= 0 && k2_offset < v_length && v2[k2_offset] != -1) {
            // Mirror x2 onto top-left coordinate system.
            var x2 = text1_length - v2[k2_offset];
            if (x1 >= x2) {
              // Overlap detected.
              return this.diff_bisectSplit_(text1, text2, x1, y1, deadline);
            }
          }
        }
      }
  
      // Walk the reverse path one step.
      for (var k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
        var k2_offset = v_offset + k2;
        var x2;
        if (k2 == -d || (k2 != d && v2[k2_offset - 1] < v2[k2_offset + 1])) {
          x2 = v2[k2_offset + 1];
        } else {
          x2 = v2[k2_offset - 1] + 1;
        }
        var y2 = x2 - k2;
        while (x2 < text1_length && y2 < text2_length &&
            text1[text1_length - x2 - 1] ===
            text2[text2_length - y2 - 1]) {
          x2++;
          y2++;
        }
        v2[k2_offset] = x2;
        if (x2 > text1_length) {
          // Ran off the left of the graph.
          k2end += 2;
        } else if (y2 > text2_length) {
          // Ran off the top of the graph.
          k2start += 2;
        } else if (!front) {
          var k1_offset = v_offset + delta - k2;
          if (k1_offset >= 0 && k1_offset < v_length && v1[k1_offset] != -1) {
            var x1 = v1[k1_offset];
            var y1 = v_offset + x1 - k1_offset;
            // Mirror x2 onto top-left coordinate system.
            x2 = text1_length - x2;
            if (x1 >= x2) {
              // Overlap detected.
              return this.diff_bisectSplit_(text1, text2, x1, y1, deadline);
            }
          }
        }
      }
    }
    // Diff took too long and hit the deadline or
    // number of diffs equals number of characters, no commonality at all.
    return [new diff_match_patch.Diff(DIFF_DELETE, text1),
            new diff_match_patch.Diff(DIFF_INSERT, text2)];
  };

  diff_match_patch.prototype.diff_bisectSplit_ = function(text1, text2, x, y,
      deadline) {
    var text1a = text1.slice(0, x);
    var text2a = text2.slice(0, y);
    var text1b = text1.slice(x);
    var text2b = text2.slice(y);
  
    // Compute both diffs serially.
    var diffs = this.diff_main(text1a, text2a, false, deadline);
    var diffsb = this.diff_main(text1b, text2b, false, deadline);
    return diffs.concat(diffsb);
  };
  


    diff_match_patch.prototype.diff_cleanupMerge = function(diffs) {
    // Add a dummy entry at the end.
    diffs.push(new diff_match_patch.Diff(DIFF_EQUAL, []));
    var pointer = 0;
    var count_delete = 0;
    var count_insert = 0;
    var text_delete = [];
    var text_insert = [];
    var commonlength;
    while (pointer < diffs.length) {
        switch (diffs[pointer][0]) {
        case DIFF_INSERT:
            count_insert++;
            text_insert.push(...diffs[pointer][1]);
            pointer++;
            break;
        case DIFF_DELETE:
            count_delete++;
            text_delete.push(...diffs[pointer][1]);
            pointer++;
            break;
        case DIFF_EQUAL:
            // Upon reaching an equality, check for prior redundancies.
            if (count_delete + count_insert > 1) {
            if (count_delete !== 0 && count_insert !== 0) {
                // Factor out any common prefixies.
                commonlength = this.diff_commonPrefix(text_insert, text_delete);
                if (commonlength !== 0) {
                if ((pointer - count_delete - count_insert) > 0 &&
                    diffs[pointer - count_delete - count_insert - 1][0] === DIFF_EQUAL) {
                    diffs[pointer - count_delete - count_insert - 1][1].push(...text_insert.slice(0, commonlength));
                } else {
                    diffs.splice(0, 0, new diff_match_patch.Diff(DIFF_EQUAL, text_insert.slice(0, commonlength)));
                    pointer++;
                }
                text_insert = text_insert.slice(commonlength);
                text_delete = text_delete.slice(commonlength);
                }
                // Factor out any common suffixies.
                commonlength = this.diff_commonSuffix(text_insert, text_delete);
                if (commonlength !== 0) {
                diffs[pointer][1].push(...text_insert.slice(text_insert.length -commonlength));
                text_insert = text_insert.slice(0, text_insert.length -commonlength);
                text_delete = text_delete.slice(0, text_delete.length -commonlength);
                }
            }
            // Delete the offending records and add the merged ones.
            pointer -= count_delete + count_insert;
            diffs.splice(pointer, count_delete + count_insert);
            if (text_delete.length) {
                diffs.splice(pointer, 0, new diff_match_patch.Diff(DIFF_DELETE, text_delete));
                pointer++;
            }
            if (text_insert.length) {
                diffs.splice(pointer, 0, new diff_match_patch.Diff(DIFF_INSERT, text_insert));
                pointer++;
            }
            pointer++;
            } else if (pointer !== 0 && diffs[pointer - 1][0] == DIFF_EQUAL) {
            // Merge this equality with the previous one.
            diffs[pointer - 1][1].push(...diffs[pointer][1]);
            diffs.splice(pointer, 1);
            } else {
            pointer++;
            }
            count_insert = 0;
            count_delete = 0;
            text_delete = [];
            text_insert = [];
            break;
        
        default:
            break;
        }
    }
    if (diffs[diffs.length - 1][1] === '') {
        diffs.pop();  // Remove the dummy entry at the end.
    }

    // Second pass: look for single edits surrounded on both sides by equalities
    // which can be shifted sideways to eliminate an equality.
    // e.g: A<ins>BA</ins>C -> <ins>AB</ins>AC
    var changes = false;
    pointer = 1;
    // Intentionally ignore the first and last element (don't need checking).
    while (pointer < diffs.length - 1) {
        if (diffs[pointer - 1][0] == DIFF_EQUAL &&
            diffs[pointer + 1][0] == DIFF_EQUAL) {
        // This is a single edit surrounded by equalities.
        if (diffs[pointer][1].slice(diffs[pointer][1].length -diffs[pointer - 1][1].length) == diffs[pointer - 1][1]) {
            // Shift the edit over the previous equality.
            diffs[pointer][1] = diffs[pointer - 1][1] +
                diffs[pointer][1].slice(0, diffs[pointer][1].length -
                                            diffs[pointer - 1][1].length);
            diffs[pointer + 1][1] = diffs[pointer - 1][1] + diffs[pointer + 1][1];
            diffs.splice(pointer - 1, 1);
            changes = true;
        } else if (diffs[pointer][1].slice(0, diffs[pointer + 1][1].length) ==
            diffs[pointer + 1][1]) {
            // Shift the edit over the next equality.
            diffs[pointer - 1][1] += diffs[pointer + 1][1];
            diffs[pointer][1] =
                diffs[pointer][1].slice(diffs[pointer + 1][1].length) +
                diffs[pointer + 1][1];
            diffs.splice(pointer + 1, 1);
            changes = true;
        }
        }
        pointer++;
    }
    // If shifts were made, the diff needs reordering and another shift sweep.
    if (changes) {
        this.diff_cleanupMerge(diffs);
    }
    };

    // export diff_match_patch;