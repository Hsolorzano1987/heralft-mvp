// src/assets/js/form-handler.js - VERSIÓN MVP
const API_URL = 'https://f4tdwwihq1.execute-api.us-east-1.amazonaws.com/production/formulario';

document.getElementById('legalForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = document.querySelector('.btn-submit');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Enviando...';
    submitBtn.disabled = true;
    
    const messageDiv = document.getElementById('formMessage');
    messageDiv.innerHTML = '';
    
    try {
        const formData = {
            nombre: document.getElementById('nombre').value,
            email: document.getElementById('email').value,
            telefono: document.getElementById('telefono').value,
            servicio: document.getElementById('servicio').value,
            descripcion: document.getElementById('descripcion').value
        };
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            messageDiv.innerHTML = `
                <div class="message success">
                    <strong>✅ ${result.message}</strong>
                </div>
            `;
            document.getElementById('legalForm').reset();
            submitBtn.textContent = '✓ Enviado';
        } else {
            throw new Error(result.error || 'Error');
        }
        
    } catch (error) {
        messageDiv.innerHTML = `
            <div class="message error">
                <strong>❌ Error:</strong> ${error.message}
            </div>
        `;
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});