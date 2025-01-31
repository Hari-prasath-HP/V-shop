const imageInput = document.getElementById('images');
const imagePreviewContainer = document.getElementById('image-preview-container');
let cropperInstances = []; // To store cropper instances for each image

imageInput.addEventListener('change', (event) => {
  const files = event.target.files;
  
  // Clear the container before adding new previews
  imagePreviewContainer.innerHTML = '';

  // Limit the number of images to 3
  const imageLimit = 3;
  const filesToPreview = Array.from(files).slice(0, imageLimit);

  // Loop through the selected files and create previews
  filesToPreview.forEach((file, index) => {
    const reader = new FileReader();

    reader.onload = function (e) {
      const imagePreview = document.createElement('img');
      imagePreview.src = e.target.result;
      imagePreview.classList.add('preview-image');
      imagePreview.style.maxWidth = '200px'; // Set max width to prevent large images
      imagePreview.style.height = 'auto'; // Maintain aspect ratio

      // Create a div container for each image with crop button
      const previewContainer = document.createElement('div');
      previewContainer.classList.add('preview-container', 'mb-3');

      const cropButton = document.createElement('button');
      cropButton.classList.add('btn', 'btn-primary', 'mt-2');
      cropButton.textContent = 'Crop and Upload';
      cropButton.onclick = () => handleCropAndUpload(index);  // Bind the click to the specific cropper instance

      previewContainer.appendChild(imagePreview);
      previewContainer.appendChild(cropButton);
      imagePreviewContainer.appendChild(previewContainer);

      // Initialize cropper on the image preview
      const cropper = new Cropper(imagePreview, {
        aspectRatio: 1, // Set aspect ratio for cropping
        viewMode: 1, // Restrict the crop box to the image area
        autoCropArea: 1, // Auto size the crop area to 100% of the image
        ready: () => {
          cropperInstances.push(cropper); // Store the cropper instance
        }
      });
    };

    reader.readAsDataURL(file);
  });
});

function handleCropAndUpload(index) {
  const cropper = cropperInstances[index];
  
  if (!cropper) {
    alert('No cropper instance found');
    return;
  }
  
  // Get the cropped canvas (you can specify the width/height you want)
  const canvas = cropper.getCroppedCanvas({
    width: 500,
    height: 500
  });

  // Convert the canvas to a blob and upload it
  canvas.toBlob((blob) => {
    const formData = new FormData();
    formData.append('images', blob, `cropped-image-${index}.jpg`);

    // Send the cropped image to the server (replace '/upload-endpoint' with your server endpoint)
    fetch('/upload-endpoint', {
      method: 'POST',
      body: formData,
    })
    .then(response => response.json())
    .then(data => {
      console.log('Image uploaded successfully:', data);
      alert('Image uploaded successfully');
    })
    .catch(error => {
      console.error('Upload error:', error);
      alert('Error uploading image');
    });
  });
}
