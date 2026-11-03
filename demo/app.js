/* Demo State Ethics Portal — FICTIONAL. Nothing here sends data anywhere. */
(function () {
  'use strict';

  var form = document.getElementById('soForm');
  var navButtons = document.querySelectorAll('#stepNav button');
  var currentStep = 1;
  var step4Rendered = false;
  var officerCount = 1;
  var contributorCount = 0;

  // ---------- helpers ----------
  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function fieldContainer(input) {
    return input.closest('.field') || input.closest('td') || input.closest('fieldset') || input.parentNode;
  }

  function clearError(input) {
    input.classList.remove('has-error');
    var c = fieldContainer(input);
    var existing = c.querySelector('.error[data-for="' + (input.name || input.id) + '"]');
    if (existing) existing.remove();
  }

  function showError(input, msg) {
    clearError(input);
    input.classList.add('has-error');
    var span = document.createElement('span');
    span.className = 'error';
    span.setAttribute('role', 'alert');
    span.setAttribute('data-for', input.name || input.id);
    span.textContent = msg;
    var c = fieldContainer(input);
    if (input.type === 'radio') {
      c.appendChild(span);
    } else if (input.closest('label') && input.closest('label') !== c) {
      input.closest('label').insertAdjacentElement('afterend', span);
    } else {
      input.insertAdjacentElement('afterend', span);
    }
  }

  // Visual-asterisk-only fields are "required" per the site, but have no attribute.
  function isRequired(input) {
    if (input.required || input.getAttribute('aria-required') === 'true') return true;
    if (input.id === 'treasurer_appointed') return true;
    return false;
  }

  function friendlyName(input) {
    if (input.id) {
      var l = document.querySelector('label[for="' + input.id + '"]');
      if (l) return l.textContent.replace('*', '').trim();
    }
    var wrap = input.closest('label');
    if (wrap) return wrap.textContent.replace('*', '').trim();
    var td = input.closest('td');
    if (td && td.previousElementSibling) return td.previousElementSibling.textContent.replace('*', '').trim();
    return input.getAttribute('aria-label') || input.name;
  }

  // ---------- per-field validators (on blur) ----------
  var validators = {
    zip: function (v) { return /^\d{5}$/.test(v) ? null : 'ZIP code must be 5 digits'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter a valid email address (e.g. name@example.org)'; },
    routing: function (v) { return /^\d{9}$/.test(v) ? null : 'Routing number must be exactly 9 digits'; },
    amount: function (v) {
      if (!/^\d{1,9}(\.\d{1,2})?$/.test(v.replace(/[$,]/g, ''))) return 'Amount must be a dollar value, e.g. 250.00';
      return null;
    }
  };

  function validateField(input, checkEmpty) {
    var v = (input.value || '').trim();
    if (input.type === 'radio') {
      var group = form.querySelectorAll('input[name="' + input.name + '"]');
      var any = Array.prototype.some.call(group, function (r) { return r.checked; });
      if (checkEmpty && isRequired(group[0]) && !any) {
        showError(group[0], 'Please select an option');
        return false;
      }
      clearError(group[0]);
      return true;
    }
    if (input.type === 'checkbox') {
      if (checkEmpty && isRequired(input) && !input.checked) {
        showError(input, 'You must check this box to continue');
        return false;
      }
      clearError(input);
      return true;
    }
    if (!v) {
      if (checkEmpty && isRequired(input)) {
        showError(input, friendlyName(input) + ' is required');
        return false;
      }
      clearError(input);
      return true;
    }
    var kind = input.getAttribute('data-validate');
    if (kind && validators[kind]) {
      var msg = validators[kind](v);
      if (msg) { showError(input, msg); return false; }
    }
    clearError(input);
    return true;
  }

  form.addEventListener('blur', function (e) {
    var t = e.target;
    if (t.matches && t.matches('input[data-validate]')) validateField(t, false);
  }, true);

  function validateStep(n, quiet) {
    var section = document.getElementById('step' + n);
    var inputs = section.querySelectorAll('input:not([type=hidden]):not([type=button]), select, textarea');
    var bad = 0;
    var seenRadio = {};
    Array.prototype.forEach.call(inputs, function (i) {
      if (i.type === 'radio') {
        if (seenRadio[i.name]) return;
        seenRadio[i.name] = true;
      }
      if (!validateField(i, true)) bad++;
    });
    var old = section.querySelector('.step-summary');
    if (old) old.remove();
    if (!quiet) {
      var box = el(bad
        ? '<div class="step-summary" role="alert">There ' + (bad === 1 ? 'is 1 problem' : 'are ' + bad + ' problems') + ' on this page. Please correct the highlighted fields.</div>'
        : '<div class="step-summary ok" role="status">No problems found on this page.</div>');
      section.insertBefore(box, section.querySelector('h2').nextSibling);
    }
    return bad === 0;
  }

  // ---------- step navigation ----------
  function goTo(n) {
    if (n === 4 && !step4Rendered) renderStep4();
    for (var i = 1; i <= 4; i++) {
      document.getElementById('step' + i).hidden = (i !== n);
    }
    Array.prototype.forEach.call(navButtons, function (b) {
      var s = Number(b.getAttribute('data-step'));
      b.classList.toggle('active', s === n);
      if (s < n) b.classList.add('done');
    });
    currentStep = n;
    window.scrollTo(0, 0);
  }

  Array.prototype.forEach.call(navButtons, function (b) {
    b.addEventListener('click', function () { goTo(Number(b.getAttribute('data-step'))); });
  });

  form.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    if (action === 'next') goTo(Math.min(4, currentStep + 1));
    else if (action === 'prev') goTo(Math.max(1, currentStep - 1));
    else if (action === 'validate') validateStep(currentStep, false);
  });

  // ---------- conditional connected-organization fields ----------
  form.addEventListener('change', function (e) {
    if (e.target.name !== 'has_connected_org') return;
    var slot = document.getElementById('connectedOrgSlot');
    if (e.target.value === 'yes' && !document.getElementById('connected_org_name')) {
      slot.appendChild(el(
        '<div class="conditional" id="connectedOrgFields">' +
          '<div class="field">' +
            '<label for="connected_org_name">Connected Organization Name <span class="req">*</span></label>' +
            '<input type="text" id="connected_org_name" name="connected_org_name" required>' +
          '</div>' +
          '<div class="field">' +
            '<label for="connected_org_relationship">Relationship to Committee <span class="req">*</span></label>' +
            '<select id="connected_org_relationship" name="connected_org_relationship" required>' +
              '<option value="">-- Select --</option>' +
              '<option value="corp">Corporation (sponsor)</option>' +
              '<option value="labor">Labor organization</option>' +
              '<option value="trade">Trade association</option>' +
              '<option value="membership">Membership organization</option>' +
              '<option value="coop">Cooperative</option>' +
            '</select>' +
            '<small>The organization that directly or indirectly establishes, administers or financially supports the committee.</small>' +
          '</div>' +
        '</div>'
      ));
    } else if (e.target.value === 'no') {
      slot.innerHTML = '';
    }
  });

  // ---------- add officer rows ----------
  document.getElementById('addOfficer').addEventListener('click', function () {
    var i = officerCount++;
    var row = el(
      '<tr class="officer-row">' +
        '<td><input type="text" name="officers[' + i + '][name]" aria-labelledby="th_off_name"></td>' +
        '<td><input type="text" name="officers[' + i + '][title]" aria-labelledby="th_off_title"></td>' +
        '<td><input type="email" name="officers[' + i + '][email]" aria-labelledby="th_off_email" data-validate="email"></td>' +
        '<td><button type="button" class="btn link" data-remove-row>Remove</button></td>' +
      '</tr>'
    );
    document.getElementById('officerRows').appendChild(row);
    row.querySelector('input').focus();
  });

  form.addEventListener('click', function (e) {
    var r = e.target.closest('[data-remove-row]');
    if (r) r.closest('tr').remove();
  });

  // ---------- Step 4: rendered dynamically on first visit ----------
  function contributorRow(i) {
    return el(
      '<tr class="contrib-row">' +
        '<td><input type="text" name="contributors[' + i + '][name]" aria-label="Contributor ' + (i + 1) + ' full name"></td>' +
        '<td><input type="text" name="contributors[' + i + '][employer]" placeholder="Employer"></td>' +
        '<td><input type="text" name="contributors[' + i + '][occupation]" placeholder="Occupation"></td>' +
        '<td><input type="text" name="contributors[' + i + '][amount]" inputmode="decimal" placeholder="0.00" data-validate="amount" aria-label="Contribution amount"></td>' +
        '<td><input type="date" name="contributors[' + i + '][date]" aria-label="Date received"></td>' +
      '</tr>'
    );
  }

  function renderStep4() {
    var s = document.getElementById('step4');
    s.innerHTML =
      '<h2>Part 4 &mdash; First Campaign Finance Report</h2>' +
      '<p class="instructions">If the committee accepted contributions or made expenditures before filing this statement, report that activity below.</p>' +

      '<div class="field">' +
        '<label for="filing_period">Filing Period <span class="req">*</span></label>' +
        '<select id="filing_period" name="filing_period" required>' +
          '<option value="">-- Select --</option>' +
          '<option value="JAN">January Semiannual</option>' +
          '<option value="JUL">July Semiannual</option>' +
          '<option value="30DAY">30th Day Before Election</option>' +
          '<option value="8DAY">8th Day Before Election</option>' +
          '<option value="MONTHLY">Monthly</option>' +
        '</select>' +
      '</div>' +

      '<div class="field inline">' +
        '<div><label for="coverage_start">Coverage Start <span class="req">*</span></label>' +
        '<input type="date" id="coverage_start" name="coverage_start" required></div>' +
        '<div><label for="coverage_end">Coverage End <span class="req">*</span></label>' +
        '<input type="date" id="coverage_end" name="coverage_end" required></div>' +
      '</div>' +

      '<div class="field">' +
        '<label for="cash_on_hand_start">Cash on Hand at Start of Period</label>' +
        '<input type="text" id="cash_on_hand_start" name="cash_on_hand_start" inputmode="decimal" data-validate="amount" aria-describedby="coh_help">' +
        '<div class="help" id="coh_help">Enter 0.00 if this is the committee\'s first report.</div>' +
      '</div>' +

      '<div class="field">' +
        '<label for="total_contributions">Total Political Contributions <span class="req">*</span></label>' +
        '<input type="text" id="total_contributions" name="total_contributions" inputmode="decimal" data-validate="amount" aria-required="true">' +
        '<small>Include contributions of $90 or less that are not itemized.</small>' +
      '</div>' +

      '<h3>Itemized Contributions (over $90)</h3>' +
      '<table class="contrib-table">' +
        '<thead><tr><th>Contributor Name</th><th>Employer</th><th>Occupation</th><th>Amount</th><th>Date</th></tr></thead>' +
        '<tbody id="contribRows"></tbody>' +
      '</table>' +
      '<button type="button" class="btn secondary small" id="addContributor">+ Add contributor</button>' +

      '<h3>Certification</h3>' +
      '<div class="field">' +
        '<label class="check"><input type="checkbox" id="certify" name="certify" value="1" required> ' +
        'I certify that I have examined this statement and to the best of my knowledge and belief it is true, correct and complete. <span class="req">*</span></label>' +
      '</div>' +

      '<div class="reauth">' +
        '<h3>Re-authenticate to sign</h3>' +
        '<small>For your security, enter your Portal PIN to apply your electronic signature.</small>' +
        '<div class="field">' +
          '<label for="portal_pin">Portal PIN <span class="req">*</span></label>' +
          '<input type="password" id="portal_pin" name="portal_pin" autocomplete="current-password" maxlength="8" required>' +
        '</div>' +
      '</div>' +

      '<div class="step-actions">' +
        '<button type="button" class="btn secondary" data-action="prev">&laquo; Back</button>' +
        '<button type="button" class="btn secondary" data-action="validate">Validate step</button>' +
        '<button type="submit" class="btn submit" id="submitBtn">Submit Statement</button>' +
      '</div>';

    var tbody = s.querySelector('#contribRows');
    tbody.appendChild(contributorRow(contributorCount++));
    s.querySelector('#addContributor').addEventListener('click', function () {
      tbody.appendChild(contributorRow(contributorCount++));
    });
    step4Rendered = true;
  }

  // ---------- submit: never navigates ----------
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    alert('Demo: nothing was submitted');
  });
})();
