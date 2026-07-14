class Logger {
  constructor() {
    this.logs = [];
    this.loadFromStorage();
  }

  // 로그 레벨
  static LEVELS = {
    INFO: 'INFO',
    WARN: 'WARN', 
    ERROR: 'ERROR',
    FATAL: 'FATAL'
  };

  // 로그 추가
  add(level, category, message, data = {}) {
    const log = {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      level,
      category,
      message,
      data,
      resolved: false
    };
    
    this.logs.push(log);
    this.saveToStorage();
    
    // 콘솔에도 출력
    // const consoleMethod = level === 'ERROR' || level === 'FATAL' ? 'error' : 
    //                      level === 'WARN' ? 'warn' : 'log';
    // console[consoleMethod](`[${level}] ${category}: ${message}`, data);
    
    console.log(`📝 로그 추가됨: ${level} - ${category} - ${message} (총 로그 수: ${this.logs.length})`);
    console.log(`📝 로그 상세:`, { level, category, message, data });
    console.log(`📝 현재 저장된 로그들:`, this.logs.map(log => ({ 
      category: log.category, 
      level: log.level, 
      message: log.message.substring(0, 30) + '...',
      id: log.id 
    })));
    
    return log;
  }

  // 레벨별 로그 메서드
  info(category, message, data = {}) {
    return this.add(Logger.LEVELS.INFO, category, message, data);
  }

  warn(category, message, data = {}) {
    return this.add(Logger.LEVELS.WARN, category, message, data);
  }

  error(category, message, data = {}) {
    return this.add(Logger.LEVELS.ERROR, category, message, data);
  }

  fatal(category, message, data = {}) {
    return this.add(Logger.LEVELS.FATAL, category, message, data);
  }

  // 해결된 오류 로그 정리
  cleanResolvedErrors(fileName = null) {
    const beforeCount = this.logs.length;
    
    if (fileName) {
      // 특정 파일의 오류 로그와 성공 로그 모두 정리
      this.logs = this.logs.filter(log => {
        const logFile = log.data?.file || log.data?.path || 'unknown';
        
        if (logFile === fileName) {
          // 성공 메시지가 포함된 로그는 제거
          if (log.message.includes('완료') || log.message.includes('성공')) {
            console.log(`🧹 성공 로그 제거: ${fileName} - ${log.message}`);
            return false;
          }
          
          // 해당 파일의 오류 로그도 제거 (파일이 수정되었으므로)
          if (log.level === 'ERROR' || log.level === 'FATAL') {
            console.log(`🧹 수정된 파일의 오류 로그 제거: ${fileName} - ${log.message}`);
            return false;
          }
        }
        return true;
      });
    } else {
      // 모든 성공 로그와 해결된 오류 로그 정리
      this.logs = this.logs.filter(log => {
        // 성공 메시지가 포함된 로그는 제거
        if (log.message.includes('완료') || log.message.includes('성공')) {
          return false;
        }
        return true;
      });
    }
    
    const afterCount = this.logs.length;
    const cleanedCount = beforeCount - afterCount;
    
    if (cleanedCount > 0) {
      console.log(`🧹 정리된 로그: ${cleanedCount}개`);
      this.saveToStorage();
    }
    
    return cleanedCount;
  }

  // 카테고리별 로그 정리 메서드
  cleanCategoryLogs(logs, category) {
    const logsToKeep = [];
    
    for (const log of logs) {
      // ERROR/FATAL 레벨만 유지
      if (log.level === 'ERROR' || log.level === 'FATAL') {
        // 해당 파일의 성공 로그가 있는지 확인
        const file = log.data?.file || log.data?.path || 'unknown';
        const hasSuccessLog = logs.some(successLog => 
          (successLog.level === 'INFO' || successLog.level === 'WARN') &&
          (successLog.data?.file === file || successLog.data?.path === file) &&
          (successLog.message.includes('완료') || successLog.message.includes('성공'))
        );
        
        // 성공 로그가 있으면 이 오류 로그도 제거
        if (hasSuccessLog) {
          console.log(`🧹 ${category} 해결된 오류 로그 제거: ${file} - ${log.message}`);
          continue; // 이 로그는 건너뛰기
        }
        
        logsToKeep.push(log);
      } else {
        // 성공 메시지가 포함된 로그는 제거
        if (log.message.includes('완료') || log.message.includes('성공')) {
          console.log(`🧹 ${category} 성공 로그 제거: ${log.message}`);
          continue; // 이 로그는 건너뛰기
        }
        
        // INFO/WARN 로그는 제거 (오류가 아니므로)
        console.log(`🧹 ${category} INFO/WARN 로그 제거: ${log.message}`);
        continue; // 이 로그는 건너뛰기
      }
    }
    
    return logsToKeep;
  }

  // 오류 로그 자동 정리 완전 비활성화 (로그가 사라지는 문제 해결)
  autoCleanErrors() {
    console.log('🔒 autoCleanErrors 완전 비활성화 - 모든 로그 유지');
    return 0; // 항상 0 반환하여 정리하지 않음
  }

  // 로그 필터링
  getLogs(level = null, category = null) {
    console.log(`🔍 getLogs 호출됨: level=${level}, category=${category}, 총 로그 수=${this.logs.length}`);
    
    let filteredLogs = this.logs;
    
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
      console.log(`🔍 level 필터링 후: ${filteredLogs.length}개`);
    }
    
    if (category) {
      filteredLogs = filteredLogs.filter(log => log.category === category);
      console.log(`🔍 category 필터링 후: ${filteredLogs.length}개`);
    }
    
    console.log(`🔍 getLogs 반환: ${filteredLogs.length}개`);
    console.log(`🔍 getLogs 상세:`, filteredLogs.map(log => ({ 
      category: log.category, 
      level: log.level, 
      message: log.message.substring(0, 50) + '...',
      id: log.id 
    })));
    return filteredLogs;
  }

  // 로그 초기화
  clear() {
    this.logs = [];
    this.saveToStorage();
  }

  // 강제로 모든 오류 로그 정리 완전 비활성화
  forceCleanAllErrors() {
    console.log('🔒 forceCleanAllErrors 완전 비활성화 - 모든 로그 유지');
    return 0; // 항상 0 반환하여 정리하지 않음
  }

  // localStorage에 저장
  saveToStorage() {
    try {
      localStorage.setItem('logger-logs', JSON.stringify(this.logs));
      console.log(`💾 로그 저장됨: ${this.logs.length}개`);
    } catch (error) {
      console.error('❌ 로그 저장 실패:', error);
    }
  }

  // localStorage에서 로드
  loadFromStorage() {
    try {
      const saved = localStorage.getItem('logger-logs');
      if (saved) {
        this.logs = JSON.parse(saved);
        console.log(`📂 로그 로드됨: ${this.logs.length}개`);
      }
    } catch (error) {
      console.error('❌ 로그 로드 실패:', error);
      this.logs = [];
    }
  }
}

// 싱글톤 인스턴스 생성
const logger = new Logger();

export default logger;
