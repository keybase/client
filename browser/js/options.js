// Return form values as a key-value object.
function get(f) {
  const r = {};
  for (const el of f.elements) {
    switch (el.type) {
      case "checkbox":
        r[el.name] = el.checked;
        break;
      default:
        r[el.name] = el.value;
    }
  }
  return r;
}

// Set form values from a key-value object.
function set(f, values) {
  for (const k in values) {
    switch (f[k].type) {
      case "checkbox":
        f[k].checked = !!values[k];
        break;
      default:
        f[k] = values[k];
    }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const f = document.forms[0];

  // Populate default initial values
  const initValues = get(f);
  chrome.storage.local.get(initValues, function(options) {
    // Update form to match our storage values
    set(f, options);
  });

  // Save changes when our form changes.
  f.addEventListener('change', function(e) {
    const values = get(f);
    chrome.storage.local.set(values);
  });
});

