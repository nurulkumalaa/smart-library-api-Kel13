import { pool } from '../config/db.js';

export const LoanModel = {
  async createLoan(book_id, member_id, due_date) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const bookCheck = await client.query(
        'SELECT available_copies FROM books WHERE id = $1',
        [book_id]
      );

      if (bookCheck.rows[0].available_copies <= 0) {
        throw new Error('Buku sedang tidak tersedia (stok habis).');
      }

      await client.query(
        'UPDATE books SET available_copies = available_copies - 1 WHERE id = $1',
        [book_id]
      );

      const loanQuery = `
        INSERT INTO loans (book_id, member_id, due_date) 
        VALUES ($1, $2, $3) RETURNING *
      `;

      const result = await client.query(loanQuery, [
        book_id,
        member_id,
        due_date
      ]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async getAllLoans() {
    const query = `
      SELECT l.*, b.title as book_title, m.full_name as member_name 
      FROM loans l
      JOIN books b ON l.book_id = b.id
      JOIN members m ON l.member_id = m.id
    `;

    const result = await pool.query(query);
    return result.rows;
  },

  async getTopBorrowers() {
    const query = `
      WITH borrower_stats AS (
        SELECT 
          m.id,
          m.full_name,
          m.email,
          m.member_type,
          m.joined_at,
          COUNT(l.id) AS total_pinjaman,
          MAX(l.loan_date) AS pinjaman_terakhir
        FROM members m
        JOIN loans l ON m.id = l.member_id
        GROUP BY m.id, m.full_name, m.email, m.member_type, m.joined_at
      ),
      favorite_books AS (
        SELECT 
          l.member_id,
          b.title AS buku_favorit,
          COUNT(*) AS jumlah_dipinjam,
          ROW_NUMBER() OVER (
            PARTITION BY l.member_id 
            ORDER BY COUNT(*) DESC, b.title ASC
          ) AS rank
        FROM loans l
        JOIN books b ON l.book_id = b.id
        GROUP BY l.member_id, b.title
      )
      SELECT 
        bs.id,
        bs.full_name,
        bs.email,
        bs.member_type,
        bs.joined_at,
        bs.total_pinjaman,
        fb.buku_favorit,
        bs.pinjaman_terakhir
      FROM borrower_stats bs
      JOIN favorite_books fb ON bs.id = fb.member_id
      WHERE fb.rank = 1
      ORDER BY bs.total_pinjaman DESC, bs.pinjaman_terakhir DESC
      LIMIT 3;
    `;

    const result = await pool.query(query);
    return result.rows;
  }
};