/** 인증 API 라우터 */
import { Request, Response, NextFunction } from 'express';
export declare const authRouter: import("express-serve-static-core").Router;
/** JWT에서 현재 사용자 추출 */
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): void;
/** 관리자 권한 확인 */
export declare function adminMiddleware(req: Request, res: Response, next: NextFunction): void;
