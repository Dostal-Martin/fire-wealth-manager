export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4,1fr)',
          gap: '20px',
          marginTop: '20px',
        }}
      >
        <div className="card">
          <h3>Portfolio</h3>
          <p>17,1 mil Kč</p>
        </div>

        <div className="card">
          <h3>YTD</h3>
          <p>+13,4 %</p>
        </div>

        <div className="card">
          <h3>XIRR</h3>
          <p>11,8 %</p>
        </div>

        <div className="card">
          <h3>FIRE</h3>
          <p>110 %</p>
        </div>
      </div>
    </div>
  )
}