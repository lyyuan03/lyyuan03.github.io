document.addEventListener('DOMContentLoaded', function () {
  var dropdownItems = document.querySelectorAll('.nav-links > li');

  dropdownItems.forEach(function (item) {
    var trigger = item.querySelector(':scope > .has-dropdown');
    var dropdown = item.querySelector(':scope > .dropdown');
    if (!trigger || !dropdown) return;

    trigger.setAttribute('role', 'button');
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('aria-expanded', 'false');

    function closeAll() {
      dropdownItems.forEach(function (otherItem) {
        otherItem.classList.remove('dropdown-open');
        var otherTrigger = otherItem.querySelector(':scope > .has-dropdown');
        if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
      });
    }

    function toggle(event) {
      event.preventDefault();
      event.stopPropagation();
      var isOpen = item.classList.contains('dropdown-open');
      closeAll();
      if (!isOpen) {
        item.classList.add('dropdown-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    }

    trigger.addEventListener('click', toggle);
    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') toggle(event);
      if (event.key === 'Escape') closeAll();
    });

    dropdown.addEventListener('click', function (event) {
      event.stopPropagation();
    });
  });

  document.addEventListener('click', function () {
    dropdownItems.forEach(function (item) {
      item.classList.remove('dropdown-open');
      var trigger = item.querySelector(':scope > .has-dropdown');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  });
});
