// Shop View Switcher
// Handles switching between different shop views using radio buttons

document.addEventListener('DOMContentLoaded', function() {
  const radioButtons = document.querySelectorAll('.shop-page__radio');
  const shopViews = document.querySelectorAll('.shop-view');
  
  // Function to switch views
  function switchView(viewName) {
    shopViews.forEach(view => {
      if (view.dataset.view === viewName) {
        view.style.display = 'block';
        // Add fade-in animation
        view.style.opacity = '0';
        setTimeout(() => {
          view.style.transition = 'opacity 0.3s ease';
          view.style.opacity = '1';
        }, 10);
      } else {
        view.style.display = 'none';
      }
    });
  }
  
  // Add event listeners to radio buttons
  radioButtons.forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.checked) {
        switchView(this.value);
      }
    });
  });
  
  // Initialize with the checked view
  const checkedRadio = document.querySelector('.shop-page__radio:checked');
  if (checkedRadio) {
    switchView(checkedRadio.value);
  }
});
