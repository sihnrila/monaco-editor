import React, { useState } from 'react';
import { DEFAULT_PREVIEW_DEVICES, DEFAULT_CUSTOM_DEVICE } from '../../constants/previewDevices';
import './PreviewPane.css';

const PreviewPane = ({ 
  output, 
  width, 
  visible = true 
}) => {
  const [previewDevice, setPreviewDevice] = useState(DEFAULT_PREVIEW_DEVICES[0]);
  const [customDevice, setCustomDevice] = useState(DEFAULT_CUSTOM_DEVICE);

  if (!visible) return null;

  const currentWidth = previewDevice.label === 'Custom' ? customDevice.width : previewDevice.width;
  const currentHeight = previewDevice.label === 'Custom' ? customDevice.height : previewDevice.height;

  return (
    <div className="preview-pane" style={{ width }}>
      <div className="preview-header">
        <h3>
          <span className="material-symbols-outlined" style={{fontSize: '18px'}}>preview</span>
          미리보기
        </h3>
        {/* <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={previewDevice.label}
            onChange={e => {
              const selected = DEFAULT_PREVIEW_DEVICES.find(d => d.label === e.target.value);
              setPreviewDevice(selected);
            }}
            style={{ 
              marginRight: 8, 
              padding: '2px 6px', 
              borderRadius: 4, 
              border: '1px solid #ccc', 
              fontSize: 13 
            }}
          >
            {DEFAULT_PREVIEW_DEVICES.map(d => (
              <option key={d.label} value={d.label}>{d.label}</option>
            ))}
          </select>
          
          {previewDevice.label === 'Custom' && (
            <>
              <input
                type="number"
                min={100}
                max={2000}
                value={customDevice.width}
                onChange={e => setCustomDevice({ 
                  ...customDevice, 
                  width: Number(e.target.value) 
                })}
                style={{ 
                  width: 60, 
                  marginRight: 4, 
                  padding: '2px 4px', 
                  borderRadius: 4, 
                  border: '1px solid #ccc', 
                  fontSize: 13 
                }}
                placeholder="W"
              />
              <span style={{ color: '#888' }}>x</span>
              <input
                type="number"
                min={100}
                max={2000}
                value={customDevice.height}
                onChange={e => setCustomDevice({ 
                  ...customDevice, 
                  height: Number(e.target.value) 
                })}
                style={{ 
                  width: 60, 
                  marginLeft: 4, 
                  padding: '2px 4px', 
                  borderRadius: 4, 
                  border: '1px solid #ccc', 
                  fontSize: 13 
                }}
                placeholder="H"
              />
            </>
          )}
          
          <span style={{ color: '#aaa', fontSize: 12, marginLeft: 8 }}>
            {previewDevice.label === 'Custom'
              ? `${customDevice.width} x ${customDevice.height}`
              : `${previewDevice.width} x ${previewDevice.height}`}
          </span>
        </div> */}
      </div>
      
      <iframe 
        srcDoc={output} 
        title="Preview" 
        className="preview-iframe"
        sandbox="allow-scripts allow-same-origin"
        style={{
          width: currentWidth,
          height: currentHeight,
          maxWidth: '100%',
          margin: '16px auto',
          display: 'block',
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}
      />
    </div>
  );
};

export default PreviewPane;