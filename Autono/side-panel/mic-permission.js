// Asks for the microphone once, from a normal tab (the side panel cannot show the prompt)
const statusEl = document.getElementById('status');

async function askForMicrophone() {
  statusEl.className = '';
  statusEl.textContent = 'Waiting for your answer…';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop()); // we only needed the permission
    statusEl.className = 'ok';
    statusEl.textContent = 'Done! You can close this tab and click the mic in Autono.';
  } catch (err) {
    statusEl.className = 'bad';
    statusEl.textContent = err && err.name === 'NotAllowedError'
      ? 'The microphone is blocked. Click the lock icon next to the address bar, allow the microphone and try again.'
      : `Could not use the microphone: ${err && err.message ? err.message : err}`;
  }
}

document.getElementById('allow').addEventListener('click', askForMicrophone);
askForMicrophone();
