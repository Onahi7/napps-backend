import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'pg';

interface PostgresSchool {
  id: number;
  name: string;
  chapter_name: string;
  lga?: string;
}

@Injectable()
export class PostgresSchoolsService {
  private readonly logger = new Logger(PostgresSchoolsService.name);
  private readonly connectionString: string;

  constructor() {
    this.connectionString = process.env.POSTGRES_DATABASE_URL;
    
    if (!this.connectionString) {
      this.logger.warn('POSTGRES_DATABASE_URL not set in environment variables');
    } else {
      this.logger.log('PostgreSQL connection configured');
    }
  }

  /**
   * Get schools from PostgreSQL database filtered by chapter
   */
  async getSchoolsByChapter(chapter?: string): Promise<Array<{ id: string; name: string; chapter?: string; lga?: string }>> {
    const client = new Client({
      connectionString: this.connectionString,
    });

    try {
      await client.connect();

      let query = `
        SELECT 
          s.id,
          s.name,
          c.name as chapter_name,
          s.lga
        FROM schools s
        INNER JOIN chapters c ON s.chapter_id = c.id
        WHERE 1=1
      `;

      const params: any[] = [];

      if (chapter) {
        query += ` AND c.name = $1`;
        params.push(chapter);
      }

      query += ` ORDER BY s.name ASC`;

      this.logger.log(`Fetching schools from PostgreSQL${chapter ? ` for chapter: ${chapter}` : ''}`);
      
      const result = await client.query(query, params);

      this.logger.log(`Found ${result.rows.length} schools in PostgreSQL`);

      return result.rows.map((row: PostgresSchool) => ({
        id: row.id.toString(),
        name: row.name,
        chapter: row.chapter_name,
        lga: row.lga || undefined,
      }));

    } catch (error: any) {
      this.logger.error(`Failed to fetch schools from PostgreSQL: ${error?.message || error}`);
      throw error;
    } finally {
      await client.end();
    }
  }

  /**
   * Get all chapters from PostgreSQL
   */
  async getAllChapters(): Promise<Array<{ id: number; name: string }>> {
    const client = new Client({
      connectionString: this.connectionString,
    });

    try {
      await client.connect();

      const result = await client.query(`
        SELECT id, name 
        FROM chapters 
        ORDER BY name ASC
      `);

      return result.rows;

    } catch (error: any) {
      this.logger.error(`Failed to fetch chapters from PostgreSQL: ${error?.message || error}`);
      throw error;
    } finally {
      await client.end();
    }
  }

  /**
   * Get school count by chapter
   */
  async getSchoolCountByChapter(): Promise<Record<string, number>> {
    const client = new Client({
      connectionString: this.connectionString,
    });

    try {
      await client.connect();

      const result = await client.query(`
        SELECT 
          c.name as chapter_name,
          COUNT(s.id) as school_count
        FROM chapters c
        LEFT JOIN schools s ON s.chapter_id = c.id
        GROUP BY c.name
        ORDER BY c.name ASC
      `);

      const counts: Record<string, number> = {};
      result.rows.forEach((row: any) => {
        counts[row.chapter_name] = parseInt(row.school_count, 10);
      });

      return counts;

    } catch (error: any) {
      this.logger.error(`Failed to fetch school counts from PostgreSQL: ${error?.message || error}`);
      throw error;
    } finally {
      await client.end();
    }
  }
}
