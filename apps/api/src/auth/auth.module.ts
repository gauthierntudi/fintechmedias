import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ActivityModule } from '../activity/activity.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminStaffController } from './admin-staff.controller';
import { AdminStaffService } from './admin-staff.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtAdminStrategy } from './strategies/jwt-admin.strategy';
import { TurnstileService } from './turnstile.service';

@Module({
  imports: [
    ActivityModule,
    PassportModule.register({ defaultStrategy: 'jwt-access' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_ACCESS_SECRET')?.trim();
        if (!secret) {
          // Ne pas faire planter le bootstrap (containers CF) — les routes auth échoueront.
          console.error(
            '[auth] JWT_ACCESS_SECRET manquant — définir le secret Worker / env',
          );
        }
        return {
          secret: secret || 'missing-jwt-access-secret',
        };
      },
    }),
  ],
  controllers: [
    AuthController,
    AdminAuthController,
    AdminStaffController,
    AdminDashboardController,
  ],
  providers: [
    AuthService,
    AdminAuthService,
    AdminStaffService,
    AdminDashboardService,
    RolesGuard,
    JwtAccessStrategy,
    JwtAdminStrategy,
    TurnstileService,
  ],
  exports: [AuthService, AdminAuthService, JwtModule, RolesGuard, PassportModule, TurnstileService],
})
export class AuthModule {}
